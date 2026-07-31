import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Error as MongooseError, Model, Types } from 'mongoose';
import { MongoServerError } from 'mongodb';
import { Game, GameDocument, GamePlayer } from './schema/game.schema';
import { CreateGameDto } from './dto/create-game.dto';
import { generateResourceId } from './resource-id';
import { GameState, StatusMessage } from './interfaces/game.interface';
import {
  clockAfterMove,
  opposite,
  projectGame,
  spentSince,
} from './game-projection';
import {
  RequestedTermination,
  Termination,
  resolveTermination,
} from './termination';
import { ChessEngineService } from '../chess/chess-engine.service';
import { PieceColor } from '../chess/interfaces/chess.interface';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const RESOURCE_ID_ATTEMPTS = 5;
const DUPLICATE_KEY_ERROR = 11000;
const PLAYABLE_STATES: string[] = [
  GameState.waitingForFirstMove,
  GameState.active,
];

const sideKey = (color: PieceColor): 'white' | 'black' =>
  color === 'w' ? 'white' : 'black';

@Injectable()
export class GamesService {
  constructor(
    @InjectModel(Game.name) private gameModel: Model<GameDocument>,
    private chessEngine: ChessEngineService,
  ) {}

  async create(
    user: AuthenticatedUser,
    createGameDto: CreateGameDto,
  ): Promise<GameDocument> {
    const color = createGameDto.pieces ?? this.drawColor();
    const player = this.playerFrom(user);
    const { white, black, increment } = createGameDto.timeControl;

    for (let attempt = 0; attempt < RESOURCE_ID_ATTEMPTS; attempt++) {
      try {
        return await this.gameModel.create({
          resourceId: generateResourceId(),
          whitePlayer: color === 'w' ? player : null,
          blackPlayer: color === 'b' ? player : null,
          timeControl: { white, black, increment, turnTime: white },
        });
      } catch (error) {
        if (!this.isDuplicateResourceId(error)) throw error;
      }
    }

    throw new InternalServerErrorException('Could not allocate a game id');
  }

  async join(
    resourceId: string,
    user: AuthenticatedUser,
  ): Promise<GameDocument> {
    const game = await this.findByResourceId(resourceId);

    if (game.status.state !== GameState.waitingForPlayers) {
      throw new ConflictException('This game is not joinable');
    }

    const player = this.playerFrom(user);
    if (game.whitePlayer) {
      game.blackPlayer = player;
    } else {
      game.whitePlayer = player;
    }

    game.status.state = GameState.waitingForFirstMove;
    game.status.additionalInfo = StatusMessage.waitingForFirstMove;
    game.startedAt = new Date();

    return this.persist(game);
  }

  async move(
    resourceId: string,
    user: AuthenticatedUser,
    san: string,
  ): Promise<GameDocument> {
    const game = await this.findPlayableGame(resourceId);
    const colors = this.assertPlayer(game, user.id);

    if (!colors.includes(game.turn)) {
      throw new ConflictException('It is not your turn');
    }

    const now = new Date();
    await this.assertClockAlive(game, now);

    const applied = this.chessEngine.applyMove(game.pgn, san);
    if (!applied) {
      throw new UnprocessableEntityException('Illegal move');
    }

    game.history.push({
      san: applied.san,
      moveNumber: Math.floor(game.history.length / 2) + 1,
      timestamp: now,
    });
    this.chargeClock(game, applied.color, now);
    game.fen = applied.fen;
    game.pgn = applied.pgn;
    game.turn = applied.turn;
    game.status.state = GameState.active;
    game.status.additionalInfo = StatusMessage.inProgress;

    const termination = resolveTermination(applied.outcome, applied.turn, null);
    if (termination) {
      this.terminate(game, termination, now);
    }

    return this.persist(game);
  }

  async resign(
    resourceId: string,
    user: AuthenticatedUser,
  ): Promise<GameDocument> {
    const { game, colors, now } = await this.openMutation(resourceId, user);
    const by = colors.length === 1 ? colors[0] : game.turn;

    this.terminate(game, this.resolve(game, { type: 'resignation', by }), now);

    return this.persist(game);
  }

  async offerDraw(
    resourceId: string,
    user: AuthenticatedUser,
  ): Promise<GameDocument> {
    const { game, colors, now } = await this.openMutation(resourceId, user);
    const by = colors.length === 1 ? colors[0] : this.nextUnofferedSide(game);

    game.drawOffer[sideKey(by)] = true;

    if (game.drawOffer.white && game.drawOffer.black) {
      this.terminate(game, this.resolve(game, { type: 'agreement' }), now);
    }

    return this.persist(game);
  }

  async withdrawDraw(
    resourceId: string,
    user: AuthenticatedUser,
  ): Promise<GameDocument> {
    const { game, colors } = await this.openMutation(resourceId, user);
    const offered = colors.filter((color) => game.drawOffer[sideKey(color)]);

    if (offered.length === 0) {
      throw new ConflictException('You have no draw offer to withdraw');
    }

    offered.forEach((color) => {
      game.drawOffer[sideKey(color)] = false;
    });

    return this.persist(game);
  }

  async legalMoves(
    resourceId: string,
  ): Promise<{ game: GameDocument; moves: string[] }> {
    const game = await this.findPlayableGame(resourceId);

    return { game, moves: this.chessEngine.legalMoves(game.pgn) };
  }

  async findByResourceId(resourceId: string): Promise<GameDocument> {
    const game = await this.gameModel.findOne({ resourceId }).exec();
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return game;
  }

  private async findPlayableGame(resourceId: string): Promise<GameDocument> {
    const game = await this.findByResourceId(resourceId);

    if (!PLAYABLE_STATES.includes(game.status.state)) {
      throw new ConflictException('This game is not accepting moves');
    }

    return game;
  }

  private colorsOf(game: GameDocument, userId: string): PieceColor[] {
    const colors: PieceColor[] = [];

    if (game.whitePlayer?.id.toString() === userId) colors.push('w');
    if (game.blackPlayer?.id.toString() === userId) colors.push('b');

    return colors;
  }

  private chargeClock(game: GameDocument, movedBy: PieceColor, at: Date): void {
    const previous =
      game.history.length >= 2
        ? game.history[game.history.length - 2].timestamp
        : game.startedAt;

    if (!previous) return;

    const side = movedBy === 'w' ? 'white' : 'black';
    const other = movedBy === 'w' ? 'black' : 'white';

    game.timeControl[side] = clockAfterMove(
      game.timeControl.turnTime,
      spentSince(previous, at),
      game.timeControl.increment,
    );
    game.timeControl.turnTime = game.timeControl[other];
  }

  private async finishOnTime(game: GameDocument, at: Date): Promise<void> {
    const projection = projectGame(game, at);

    game.timeControl.white = projection.timeControl.white;
    game.timeControl.black = projection.timeControl.black;
    game.status.state = projection.status.state;
    game.status.result = projection.status.result;
    game.status.additionalInfo = projection.status.additionalInfo;
    game.status.finishedAt = projection.status.finishedAt;

    await this.persist(game);
  }

  private async openMutation(
    resourceId: string,
    user: AuthenticatedUser,
  ): Promise<{ game: GameDocument; colors: PieceColor[]; now: Date }> {
    const game = await this.findPlayableGame(resourceId);
    const colors = this.assertPlayer(game, user.id);
    const now = new Date();

    await this.assertClockAlive(game, now);

    return { game, colors, now };
  }

  private assertPlayer(game: GameDocument, userId: string): PieceColor[] {
    const colors = this.colorsOf(game, userId);

    if (colors.length === 0) {
      throw new ForbiddenException('You are not a player in this game');
    }

    return colors;
  }

  private async assertClockAlive(game: GameDocument, now: Date): Promise<void> {
    if (!projectGame(game, now).expiredFor) return;

    await this.finishOnTime(game, now);
    throw new ConflictException('Time is up');
  }

  private nextUnofferedSide(game: GameDocument): PieceColor {
    return game.drawOffer[sideKey(game.turn)] ? opposite(game.turn) : game.turn;
  }

  private resolve(
    game: GameDocument,
    requested: RequestedTermination,
  ): Termination {
    return resolveTermination(
      this.chessEngine.position(game.pgn).outcome,
      game.turn,
      requested,
    ) as Termination;
  }

  private terminate(
    game: GameDocument,
    termination: Termination,
    at: Date,
  ): void {
    game.status.state = GameState.finished;
    game.status.result = termination.result;
    game.status.additionalInfo = termination.additionalInfo;
    game.status.finishedAt = at;
  }

  private async persist(game: GameDocument): Promise<GameDocument> {
    try {
      return await game.save();
    } catch (error) {
      if (error instanceof MongooseError.VersionError) {
        throw new ConflictException('Game state changed, retry');
      }

      throw error;
    }
  }

  private playerFrom(user: AuthenticatedUser): GamePlayer {
    return { id: new Types.ObjectId(user.id), username: user.username };
  }

  private drawColor(): PieceColor {
    return Math.random() < 0.5 ? 'w' : 'b';
  }

  private isDuplicateResourceId(error: unknown): boolean {
    return (
      error instanceof MongoServerError &&
      error.code === DUPLICATE_KEY_ERROR &&
      Object.keys(error.keyPattern ?? {}).includes('resourceId')
    );
  }
}
