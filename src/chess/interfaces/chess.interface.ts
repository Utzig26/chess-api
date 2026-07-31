export type PieceColor = 'w' | 'b';

export type GameOutcome =
  | 'checkmate'
  | 'stalemate'
  | 'insufficientMaterial'
  | 'threefoldRepetition'
  | 'fiftyMoveRule';

export interface ChessPosition {
  fen: string;
  pgn: string;
  turn: PieceColor;
  moveNumber: number;
  outcome: GameOutcome | null;
}

export interface AppliedMove extends ChessPosition {
  san: string;
  color: PieceColor;
}
