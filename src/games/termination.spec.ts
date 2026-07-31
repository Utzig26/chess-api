import { resolveTermination } from './termination';

describe('resolveTermination', () => {
  describe('nothing to record', () => {
    it('returns nothing while the game is alive and nobody asked to end it', () => {
      expect(resolveTermination(null, 'w', null)).toBeNull();
    });
  });

  describe('the board decides on its own', () => {
    it('gives checkmate to the side that is not to move', () => {
      expect(resolveTermination('checkmate', 'b', null)).toEqual({
        result: 'White wins',
        additionalInfo: 'Checkmate',
      });
    });

    it('gives checkmate to black when white is mated', () => {
      expect(resolveTermination('checkmate', 'w', null)?.result).toBe(
        'Black wins',
      );
    });

    it.each([
      ['stalemate', 'Stalemate'],
      ['insufficientMaterial', 'Draw by insufficient material'],
      ['threefoldRepetition', 'Draw by threefold repetition'],
      ['fiftyMoveRule', 'Draw by the fifty move rule'],
    ] as const)('draws on %s', (outcome, message) => {
      expect(resolveTermination(outcome, 'w', null)).toEqual({
        result: 'Draw',
        additionalInfo: message,
      });
    });
  });

  describe('a requested end', () => {
    it('gives the win to the side that did not resign', () => {
      expect(
        resolveTermination(null, 'w', { type: 'resignation', by: 'w' }),
      ).toEqual({ result: 'Black wins', additionalInfo: 'White resigned' });
    });

    it('records black resigning', () => {
      expect(
        resolveTermination(null, 'b', { type: 'resignation', by: 'b' }),
      ).toEqual({ result: 'White wins', additionalInfo: 'Black resigned' });
    });

    it('draws on agreement', () => {
      expect(resolveTermination(null, 'w', { type: 'agreement' })).toEqual({
        result: 'Draw',
        additionalInfo: 'Draw by agreement',
      });
    });
  });

  describe('the board overrules the request', () => {
    it('records a resignation into a dead position as the draw it already was', () => {
      expect(
        resolveTermination('insufficientMaterial', 'w', {
          type: 'resignation',
          by: 'w',
        }),
      ).toEqual({
        result: 'Draw',
        additionalInfo: 'Draw by insufficient material',
      });
    });

    it('records a resignation in a mated position as the mate', () => {
      expect(
        resolveTermination('checkmate', 'w', { type: 'resignation', by: 'b' }),
      ).toEqual({ result: 'Black wins', additionalInfo: 'Checkmate' });
    });

    it('keeps the engine reason over an agreed draw', () => {
      expect(
        resolveTermination('threefoldRepetition', 'b', { type: 'agreement' })
          ?.additionalInfo,
      ).toBe('Draw by threefold repetition');
    });
  });
});
