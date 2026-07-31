import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MongoServerError } from 'mongodb';
import { Game, GameDocument, GamePlayer } from './schema/game.schema';
import { CreateGameDto } from './dto/create-game.dto';
import { generateResourceId } from './resource-id';
import { GameState, StatusMessage } from './interfaces/game.interface';
import { PieceColor } from '../chess/interfaces/chess.interface';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const RESOURCE_ID_ATTEMPTS = 5;
const DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class GamesService {
  constructor(@InjectModel(Game.name) private gameModel: Model<GameDocument>) {}

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

    return game.save();
  }

  async findByResourceId(resourceId: string): Promise<GameDocument> {
    const game = await this.gameModel.findOne({ resourceId }).exec();
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return game;
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
