export const GameState = {
  waitingForPlayers: 'WP',
  waitingForFirstMove: 'W',
  active: 'A',
  finished: 'F',
} as const;

export type GameStateValue = (typeof GameState)[keyof typeof GameState];

export const GameResult = {
  whiteWins: 'White wins',
  blackWins: 'Black wins',
  draw: 'Draw',
} as const;

export type GameResultValue = (typeof GameResult)[keyof typeof GameResult];

export const StatusMessage = {
  waitingForPlayers: 'Waiting for the players to connect',
  waitingForFirstMove: 'Waiting for the first move',
  inProgress: 'Game in progress',
} as const;

export const OutcomeMessage = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  insufficientMaterial: 'Draw by insufficient material',
  threefoldRepetition: 'Draw by threefold repetition',
  fiftyMoveRule: 'Draw by the fifty move rule',
} as const;
