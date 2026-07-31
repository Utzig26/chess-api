import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MongoServerError } from 'mongodb';
import { GamesService } from './games.service';
import { Game, GameDocument } from './schema/game.schema';
import { GameState, StatusMessage } from './interfaces/game.interface';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

describe('GamesService', () => {
  let service: GamesService;
  let model: { create: jest.Mock; findOne: jest.Mock };

  const creator: AuthenticatedUser = {
    id: '507f1f77bcf86cd799439011',
    username: 'magnus',
  };
  const opponent: AuthenticatedUser = {
    id: '507f1f77bcf86cd799439012',
    username: 'hikaru',
  };

  const timeControl = { white: 600, black: 600, increment: 5 };

  const duplicateKey = () => {
    const error = new MongoServerError({ message: 'duplicate' });
    error.code = 11000;
    error.keyPattern = { resourceId: 1 };

    return error;
  };

  const waitingGame = (overrides: Record<string, unknown> = {}) =>
    ({
      resourceId: 'brave-crimson-knight-e4',
      whitePlayer: { id: creator.id, username: creator.username },
      blackPlayer: null,
      status: { state: GameState.waitingForPlayers, additionalInfo: '' },
      startedAt: null,
      save: jest.fn().mockImplementation(function (this: unknown) {
        return this;
      }),
      ...overrides,
    }) as unknown as GameDocument;

  beforeEach(async () => {
    model = {
      create: jest.fn().mockImplementation((doc) => Promise.resolve(doc)),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: getModelToken(Game.name), useValue: model },
      ],
    }).compile();

    service = module.get(GamesService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('create', () => {
    it('gives the creator the colour they asked for', async () => {
      const game = await service.create(creator, {
        pieces: 'b',
        timeControl,
      });

      expect(game.blackPlayer?.username).toBe('magnus');
      expect(game.whitePlayer).toBeNull();
    });

    it('draws white when the colour is omitted and the draw is low', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const game = await service.create(creator, { timeControl });

      expect(game.whitePlayer?.username).toBe('magnus');
      expect(game.blackPlayer).toBeNull();
    });

    it('draws black when the colour is omitted and the draw is high', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.9);

      const game = await service.create(creator, { timeControl });

      expect(game.blackPlayer?.username).toBe('magnus');
      expect(game.whitePlayer).toBeNull();
    });

    it('opens the game waiting for the second player', async () => {
      const game = await service.create(creator, { pieces: 'w', timeControl });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ resourceId: expect.any(String) }),
      );
      expect(game.status).toBeUndefined();
    });

    it('starts the turn clock on the white side', async () => {
      const game = await service.create(creator, { pieces: 'w', timeControl });

      expect(game.timeControl).toEqual({ ...timeControl, turnTime: 600 });
    });

    it('generates a readable resource id', async () => {
      const game = await service.create(creator, { pieces: 'w', timeControl });

      expect(game.resourceId).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[a-h][1-8]$/);
    });

    it('tries another id when the unique index rejects the first', async () => {
      model.create
        .mockRejectedValueOnce(duplicateKey())
        .mockImplementationOnce((doc) => Promise.resolve(doc));

      await expect(
        service.create(creator, { pieces: 'w', timeControl }),
      ).resolves.toBeDefined();
      expect(model.create).toHaveBeenCalledTimes(2);
    });

    it('gives up after five collisions', async () => {
      model.create.mockRejectedValue(duplicateKey());

      await expect(
        service.create(creator, { pieces: 'w', timeControl }),
      ).rejects.toThrow(InternalServerErrorException);
      expect(model.create).toHaveBeenCalledTimes(5);
    });

    it('does not swallow an error that is not an id collision', async () => {
      model.create.mockRejectedValue(new Error('connection lost'));

      await expect(
        service.create(creator, { pieces: 'w', timeControl }),
      ).rejects.toThrow('connection lost');
      expect(model.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('join', () => {
    const findReturning = (game: GameDocument | null) =>
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(game),
      });

    it('takes the open colour and waits for the first move', async () => {
      findReturning(waitingGame());

      const game = await service.join('brave-crimson-knight-e4', opponent);

      expect(game.blackPlayer?.username).toBe('hikaru');
      expect(game.status.state).toBe(GameState.waitingForFirstMove);
      expect(game.status.additionalInfo).toBe(
        StatusMessage.waitingForFirstMove,
      );
    });

    it('takes white when white is the open colour', async () => {
      findReturning(
        waitingGame({
          whitePlayer: null,
          blackPlayer: { id: creator.id, username: creator.username },
        }),
      );

      const game = await service.join('brave-crimson-knight-e4', opponent);

      expect(game.whitePlayer?.username).toBe('hikaru');
    });

    it('lets the creator take the second colour and play themselves', async () => {
      findReturning(waitingGame());

      const game = await service.join('brave-crimson-knight-e4', creator);

      expect(game.whitePlayer?.username).toBe('magnus');
      expect(game.blackPlayer?.username).toBe('magnus');
      expect(game.status.state).toBe(GameState.waitingForFirstMove);
    });

    it('marks when the clock became relevant', async () => {
      findReturning(waitingGame());

      const game = await service.join('brave-crimson-knight-e4', opponent);

      expect(game.startedAt).toBeInstanceOf(Date);
    });

    it('rejects a game that is not found', async () => {
      findReturning(null);

      await expect(service.join('ghost-game-id-a1', opponent)).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each([
      GameState.waitingForFirstMove,
      GameState.active,
      GameState.finished,
    ])('rejects joining a game in %s', async (state) => {
      findReturning(waitingGame({ status: { state, additionalInfo: '' } }));

      await expect(
        service.join('brave-crimson-knight-e4', opponent),
      ).rejects.toThrow(ConflictException);
    });
  });
});
