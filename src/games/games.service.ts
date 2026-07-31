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
import {
  GameResult,
  GameState,
  OutcomeMessage,
  StatusMessage,
} from './interfaces/game.interface';
import { clockAfterMove, projectGame, spentSince } from './game-projection';
import { ChessEngineService } from '../chess/chess-engine.service';
import { GameOutcome, PieceColor } from '../chess/interfaces/chess.interface';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const RESOURCE_ID_ATTEMPTS = 5;
const DUPLICATE_KEY_ERROR = 11000;
const PLAYABLE_STATES: string[] = [
  GameState.waitingForFirstMove,
  GameState.active,
];

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
    const colors = this.colorsOf(game, user.id);

    if (colors.length === 0) {
      throw new ForbiddenException('You are not a player in this game');
    }
    if (!colors.includes(game.turn)) {
      throw new ConflictException('It is not your turn');
    }

    const now = new Date();
    if (projectGame(game, now).expiredFor) {
      await this.finishOnTime(game, now);
      throw new ConflictException('Time is up');
    }

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

    if (applied.outcome) {
      this.finish(game, applied.outcome, applied.color);
    }

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

  private finish(
    game: GameDocument,
    outcome: GameOutcome,
    movedBy: PieceColor,
  ): void {
    game.status.state = GameState.finished;
    game.status.finishedAt = new Date();
    game.status.additionalInfo = OutcomeMessage[outcome];
    game.status.result =
      outcome === 'checkmate'
        ? movedBy === 'w'
          ? GameResult.whiteWins
          : GameResult.blackWins
        : GameResult.draw;
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
