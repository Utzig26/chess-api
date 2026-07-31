import { Chess } from 'chess.js';
import { ChessEngineService, INITIAL_FEN } from './chess-engine.service';

describe('ChessEngineService', () => {
  const engine = new ChessEngineService();

  const pgnOf = (moves: string[]): string => {
    const board = new Chess();
    moves.forEach((move) => board.move(move));

    return board.pgn();
  };

  const pgnFrom = (fen: string, moves: string[] = []): string => {
    const board = new Chess(fen);
    moves.forEach((move) => board.move(move));

    return board.pgn();
  };

  const foolsMate = ['f3', 'e5', 'g4', 'Qh4#'];
  const repetition = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'];

  describe('starting position', () => {
    it('exposes a complete and parseable initial fen', () => {
      expect(engine.initialFen).toBe(INITIAL_FEN);
      expect(() => new Chess(engine.initialFen)).not.toThrow();
    });

    it('describes an empty pgn as the starting position', () => {
      const position = engine.position('');

      expect(position.fen).toBe(INITIAL_FEN);
      expect(position.turn).toBe('w');
      expect(position.moveNumber).toBe(1);
      expect(position.outcome).toBeNull();
    });

    it('offers the twenty opening moves', () => {
      expect(engine.legalMoves('')).toHaveLength(20);
    });
  });

  describe('applyMove', () => {
    it('applies a legal move and hands the turn over', () => {
      const move = engine.applyMove('', 'e4');

      expect(move).not.toBeNull();
      expect(move?.san).toBe('e4');
      expect(move?.color).toBe('w');
      expect(move?.turn).toBe('b');
    });

    it('returns null for a move that is not legal in this position', () => {
      expect(engine.applyMove('', 'e5')).toBeNull();
      expect(engine.applyMove('', 'Ke2')).toBeNull();
    });

    it('returns null for notation the engine cannot read', () => {
      expect(engine.applyMove('', 'Xz9')).toBeNull();
      expect(engine.applyMove('', '')).toBeNull();
      expect(engine.applyMove('', 'e4e5e6e7')).toBeNull();
    });

    it('leaves the given pgn untouched when the move is rejected', () => {
      const pgn = pgnOf(['e4', 'e5']);

      engine.applyMove(pgn, 'Qxf7');

      expect(engine.position(pgn).pgn).toBe(pgn);
    });

    it('grows the pgn so the next call sees the move', () => {
      const afterFirst = engine.applyMove('', 'e4');
      const afterSecond = engine.applyMove(afterFirst?.pgn ?? '', 'e5');

      expect(afterSecond?.moveNumber).toBe(2);
      expect(afterSecond?.pgn).toContain('e4');
      expect(afterSecond?.pgn).toContain('e5');
    });
  });

  describe('san notation', () => {
    it.each([
      ['a pawn push', '', 'e4'],
      ['a piece move', '', 'Nf3'],
      ['a capture', pgnOf(['e4', 'd5']), 'exd5'],
      ['a check', pgnOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'd6']), 'Ng5'],
    ])('accepts %s', (_case, pgn, san) => {
      expect(engine.applyMove(pgn, san)).not.toBeNull();
    });

    it('accepts kingside castling', () => {
      const pgn = pgnOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);

      expect(engine.applyMove(pgn, 'O-O')).not.toBeNull();
    });

    it('accepts queenside castling', () => {
      const pgn = pgnOf(['d4', 'd5', 'Nc3', 'Nc6', 'Bf4', 'Bf5', 'Qd2', 'Qd7']);

      expect(engine.applyMove(pgn, 'O-O-O')).not.toBeNull();
    });

    it('accepts promotion', () => {
      const move = engine.applyMove(
        pgnFrom('8/P6k/8/8/8/8/8/K7 w - - 0 1'),
        'a8=Q',
      );

      expect(move?.san).toBe('a8=Q');
    });

    it('accepts en passant', () => {
      const move = engine.applyMove(
        pgnFrom('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2'),
        'exd6',
      );

      expect(move).not.toBeNull();
      expect(move?.fen).toContain('3P4');
    });
  });

  describe('outcome', () => {
    it('reports nothing while the game is alive', () => {
      expect(engine.position(pgnOf(['e4', 'e5'])).outcome).toBeNull();
    });

    it('detects checkmate', () => {
      expect(engine.position(pgnOf(foolsMate)).outcome).toBe('checkmate');
    });

    it('detects stalemate', () => {
      const stalemate = pgnFrom('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');

      expect(engine.position(stalemate).outcome).toBe('stalemate');
    });

    it('detects insufficient material', () => {
      const bareKings = pgnFrom('4k3/8/8/8/8/8/8/4K3 w - - 0 1');

      expect(engine.position(bareKings).outcome).toBe('insufficientMaterial');
    });

    it('detects the fifty move rule', () => {
      const almostFifty = pgnFrom('7k/8/8/4K3/8/8/8/6R1 w - - 99 100', ['Rg2']);

      expect(engine.position(almostFifty).outcome).toBe('fiftyMoveRule');
    });

    it('reports checkmate ahead of any draw condition', () => {
      const mateWithBareBoard = pgnFrom('7k/8/6QK/8/8/8/8/8 w - - 0 1', [
        'Qg7#',
      ]);

      expect(engine.position(mateWithBareBoard).outcome).toBe('checkmate');
    });
  });

  describe('threefold repetition', () => {
    it('is reconstructed by replaying the pgn', () => {
      const pgn = pgnOf(repetition);

      expect(engine.position(pgn).outcome).toBe('threefoldRepetition');
    });

    it('is not reported before the third occurrence', () => {
      const pgn = pgnOf(repetition.slice(0, 4));

      expect(engine.position(pgn).outcome).toBeNull();
    });

    it('cannot be derived from the fen alone, which is why the pgn is stored', () => {
      const pgn = pgnOf(repetition);
      const fenOnly = engine.position(pgn).fen;

      expect(engine.position(pgn).outcome).toBe('threefoldRepetition');
      expect(engine.position(pgnFrom(fenOnly)).outcome).toBeNull();
    });
  });

  describe('derived fen', () => {
    it('always matches the position the pgn replays to', () => {
      const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'];
      const pgn = pgnOf(moves);

      const fromPgn = engine.position(pgn).fen;
      const replayed = new Chess();
      moves.forEach((move) => replayed.move(move));

      expect(fromPgn).toBe(replayed.fen());
    });
  });
});
