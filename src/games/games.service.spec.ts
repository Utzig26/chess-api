import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';
import { GamesService } from './games.service';
import { ChessEngineService } from '../chess/chess-engine.service';
import { Game, GameDocument } from './schema/game.schema';
import {
  GameResult,
  GameState,
  OutcomeMessage,
  StatusMessage,
} from './interfaces/game.interface';
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
  const spectator: AuthenticatedUser = {
    id: '507f1f77bcf86cd799439013',
    username: 'fabiano',
  };

  const timeControl = { white: 600, black: 600, increment: 5 };

  const versionConflict = () =>
    new MongooseError.VersionError(
      { _doc: { _id: 'x' }, modifiedPaths: () => ['turn'] } as never,
      0,
      ['turn'],
    );

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
      timeControl: { white: 600, black: 600, increment: 5, turnTime: 600 },
      history: [],
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
        ChessEngineService,
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

  describe('move', () => {
    const playableGame = (overrides: Record<string, unknown> = {}) =>
      ({
        resourceId: 'brave-crimson-knight-e4',
        whitePlayer: { id: creator.id, username: creator.username },
        blackPlayer: { id: opponent.id, username: opponent.username },
        turn: 'w',
        pgn: '',
        fen: '',
        history: [],
        startedAt: new Date(),
        timeControl: { white: 600, black: 600, increment: 5, turnTime: 600 },
        status: {
          state: GameState.waitingForFirstMove,
          additionalInfo: '',
          result: null,
          finishedAt: null,
        },
        save: jest.fn().mockImplementation(function (this: unknown) {
          return this;
        }),
        ...overrides,
      }) as unknown as GameDocument;

    const findReturning = (game: GameDocument | null) =>
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(game),
      });

    it('applies a legal move and hands the turn over', async () => {
      findReturning(playableGame());

      const game = await service.move('brave-crimson-knight-e4', creator, 'e4');

      expect(game.turn).toBe('b');
      expect(game.pgn).toContain('e4');
      expect(game.history).toHaveLength(1);
      expect(game.history[0].san).toBe('e4');
    });

    it('activates the game on the first move', async () => {
      findReturning(playableGame());

      const game = await service.move('brave-crimson-knight-e4', creator, 'e4');

      expect(game.status.state).toBe(GameState.active);
      expect(game.status.additionalInfo).toBe(StatusMessage.inProgress);
    });

    it('numbers the move pair the way a scoresheet does', async () => {
      const game = playableGame();
      findReturning(game);

      await service.move('brave-crimson-knight-e4', creator, 'e4');
      await service.move('brave-crimson-knight-e4', opponent, 'e5');
      await service.move('brave-crimson-knight-e4', creator, 'Nf3');

      expect(game.history.map((move) => move.moveNumber)).toEqual([1, 1, 2]);
    });

    it('rejects an illegal move without saving', async () => {
      const game = playableGame();
      findReturning(game);

      await expect(
        service.move('brave-crimson-knight-e4', creator, 'e5'),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(game.save).not.toHaveBeenCalled();
      expect(game.history).toHaveLength(0);
    });

    it('rejects notation the engine cannot read', async () => {
      findReturning(playableGame());

      await expect(
        service.move('brave-crimson-knight-e4', creator, 'Xz9'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects someone who holds neither colour', async () => {
      findReturning(playableGame());

      await expect(
        service.move('brave-crimson-knight-e4', spectator, 'e4'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a player moving out of turn', async () => {
      findReturning(playableGame());

      await expect(
        service.move('brave-crimson-knight-e4', opponent, 'e5'),
      ).rejects.toThrow(ConflictException);
    });

    it('lets a player holding both colours move each side in turn', async () => {
      const game = playableGame({
        blackPlayer: { id: creator.id, username: creator.username },
      });
      findReturning(game);

      await service.move('brave-crimson-knight-e4', creator, 'e4');
      await service.move('brave-crimson-knight-e4', creator, 'e5');

      expect(game.history).toHaveLength(2);
      expect(game.turn).toBe('w');
    });

    it('finishes the game when the move gives mate', async () => {
      const game = playableGame({
        pgn: '1. f3 e5 2. g4',
        turn: 'b',
      });
      findReturning(game);

      const result = await service.move(
        'brave-crimson-knight-e4',
        opponent,
        'Qh4#',
      );

      expect(result.status.state).toBe(GameState.finished);
      expect(result.status.result).toBe(GameResult.blackWins);
      expect(result.status.additionalInfo).toBe(OutcomeMessage.checkmate);
      expect(result.status.finishedAt).toBeInstanceOf(Date);
    });

    it.each([GameState.waitingForPlayers, GameState.finished])(
      'refuses a move while the game is in %s',
      async (state) => {
        findReturning(playableGame({ status: { state, additionalInfo: '' } }));

        await expect(
          service.move('brave-crimson-knight-e4', creator, 'e4'),
        ).rejects.toThrow(ConflictException);
      },
    );

    it('charges the first white move against the moment the game started', async () => {
      const startedAt = new Date(Date.now() - 12_000);
      const game = playableGame({ startedAt });
      findReturning(game);

      await service.move('brave-crimson-knight-e4', creator, 'e4');

      expect(game.timeControl.white).toBeCloseTo(593, 0);
      expect(game.timeControl.black).toBe(600);
      expect(game.timeControl.turnTime).toBe(600);
    });

    it('charges a later move against the previous move of the same side', async () => {
      const now = Date.now();
      const game = playableGame({
        turn: 'b',
        pgn: '1. e4',
        startedAt: new Date(now - 40_000),
        history: [
          { san: 'e4', moveNumber: 1, timestamp: new Date(now - 30_000) },
        ],
        status: {
          state: GameState.active,
          additionalInfo: '',
          result: null,
          finishedAt: null,
        },
      });
      findReturning(game);

      await service.move('brave-crimson-knight-e4', opponent, 'e5');

      expect(game.timeControl.black).toBeCloseTo(575, 0);
      expect(game.timeControl.turnTime).toBe(game.timeControl.white);
    });

    it('finishes the game on time instead of accepting the move', async () => {
      const now = Date.now();
      const game = playableGame({
        pgn: '1. e4 e5',
        startedAt: new Date(now - 700_000),
        history: [
          { san: 'e4', moveNumber: 1, timestamp: new Date(now - 700_000) },
          { san: 'e5', moveNumber: 1, timestamp: new Date(now - 601_000) },
        ],
        status: {
          state: GameState.active,
          additionalInfo: '',
          result: null,
          finishedAt: null,
        },
      });
      findReturning(game);

      await expect(
        service.move('brave-crimson-knight-e4', creator, 'Nf3'),
      ).rejects.toThrow('Time is up');

      expect(game.status.state).toBe(GameState.finished);
      expect(game.status.result).toBe(GameResult.blackWins);
      expect(game.status.additionalInfo).toBe(StatusMessage.wonOnTime);
      expect(game.timeControl.white).toBe(0);
      expect(game.save).toHaveBeenCalled();
    });

    it('reports a conflict when the game changed underneath the request', async () => {
      findReturning(
        playableGame({
          save: jest.fn().mockRejectedValue(versionConflict()),
        }),
      );

      await expect(
        service.move('brave-crimson-knight-e4', creator, 'e4'),
      ).rejects.toThrow('Game state changed, retry');
    });
  });

  describe('legalMoves', () => {
    it('lists the twenty opening moves', async () => {
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(
          waitingGame({
            pgn: '',
            status: {
              state: GameState.waitingForFirstMove,
              additionalInfo: '',
            },
          }),
        ),
      });

      const { moves } = await service.legalMoves('brave-crimson-knight-e4');

      expect(moves).toHaveLength(20);
    });

    it('refuses a game that is not accepting moves', async () => {
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(waitingGame()),
      });

      await expect(
        service.legalMoves('brave-crimson-knight-e4'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
