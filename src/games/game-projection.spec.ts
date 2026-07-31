import {
  clockAfterMove,
  opposite,
  projectGame,
  spentSince,
} from './game-projection';
import { GameState } from './interfaces/game.interface';
import { GameDocument } from './schema/game.schema';

describe('game projection', () => {
  const start = new Date('2026-07-28T12:00:00.000Z');
  const secondsLater = (seconds: number) =>
    new Date(start.getTime() + seconds * 1000);

  const activeGame = (overrides: Record<string, unknown> = {}) =>
    ({
      turn: 'w',
      timeControl: { white: 300, black: 300, increment: 5, turnTime: 300 },
      history: [{ san: 'e5', moveNumber: 1, timestamp: start }],
      status: {
        state: GameState.active,
        result: null,
        additionalInfo: 'Game in progress',
        finishedAt: null,
      },
      ...overrides,
    }) as unknown as GameDocument;

  describe('the clock only runs for the side to move', () => {
    it('discounts the elapsed time from the side holding the turn', () => {
      const projection = projectGame(activeGame(), secondsLater(30));

      expect(projection.timeControl.white).toBe(270);
    });

    it('leaves the other clock untouched', () => {
      const projection = projectGame(activeGame(), secondsLater(30));

      expect(projection.timeControl.black).toBe(300);
    });

    it('discounts from black when black is to move', () => {
      const projection = projectGame(
        activeGame({ turn: 'b' }),
        secondsLater(45),
      );

      expect(projection.timeControl.black).toBe(255);
      expect(projection.timeControl.white).toBe(300);
    });
  });

  describe('the clock does not run before the first move', () => {
    it.each([
      GameState.waitingForPlayers,
      GameState.waitingForFirstMove,
      GameState.finished,
    ])('keeps the stored clocks in %s', (state) => {
      const projection = projectGame(
        activeGame({
          status: { state, result: null, additionalInfo: '', finishedAt: null },
        }),
        secondsLater(3600),
      );

      expect(projection.timeControl).toEqual({
        white: 300,
        black: 300,
        increment: 5,
      });
      expect(projection.expiredFor).toBeNull();
    });

    it('keeps the stored clocks when no move has been recorded yet', () => {
      const projection = projectGame(
        activeGame({ history: [] }),
        secondsLater(3600),
      );

      expect(projection.timeControl.white).toBe(300);
      expect(projection.expiredFor).toBeNull();
    });
  });

  describe('running out of time', () => {
    it('reports the side to move as expired', () => {
      const projection = projectGame(activeGame(), secondsLater(301));

      expect(projection.expiredFor).toBe('w');
      expect(projection.timeControl.white).toBe(0);
    });

    it('gives the win to the other side', () => {
      const projection = projectGame(activeGame(), secondsLater(301));

      expect(projection.status).toMatchObject({
        state: GameState.finished,
        result: 'Black wins',
        additionalInfo: 'Win on time',
      });
    });

    it('gives white the win when black runs out', () => {
      const projection = projectGame(
        activeGame({ turn: 'b' }),
        secondsLater(301),
      );

      expect(projection.status.result).toBe('White wins');
    });

    it('expires exactly at zero, not a moment before', () => {
      expect(
        projectGame(activeGame(), secondsLater(299.9)).expiredFor,
      ).toBeNull();
      expect(projectGame(activeGame(), secondsLater(300)).expiredFor).toBe('w');
    });
  });

  describe('projection is pure', () => {
    it('never writes back to the document', () => {
      const game = activeGame();
      const before =
        JSON.stringify(game.timeControl) + JSON.stringify(game.status);

      projectGame(game, secondsLater(30));
      projectGame(game, secondsLater(400));

      expect(
        JSON.stringify(game.timeControl) + JSON.stringify(game.status),
      ).toBe(before);
    });

    it('answers differently for different instants from the same document', () => {
      const game = activeGame();

      expect(projectGame(game, secondsLater(10)).timeControl.white).toBe(290);
      expect(projectGame(game, secondsLater(60)).timeControl.white).toBe(240);
    });
  });

  describe('charging the clock after a move', () => {
    it('subtracts the time spent and adds the increment', () => {
      expect(clockAfterMove(300, 12, 5)).toBe(293);
    });

    it('adds nothing when the increment is zero', () => {
      expect(clockAfterMove(300, 12, 0)).toBe(288);
    });

    it('never goes below zero', () => {
      expect(clockAfterMove(10, 40, 5)).toBe(0);
    });

    it('measures the time spent between two instants', () => {
      expect(spentSince(start, secondsLater(12.5))).toBe(12.5);
    });
  });

  describe('opposite', () => {
    it('flips the colour', () => {
      expect(opposite('w')).toBe('b');
      expect(opposite('b')).toBe('w');
    });
  });
});
