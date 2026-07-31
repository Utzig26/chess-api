import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator';

const pieces = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

const pick = <T>(values: readonly T[]): T =>
  values[Math.floor(Math.random() * values.length)];

const square = (): string =>
  `${pick(files)}${Math.floor(Math.random() * 8) + 1}`;

export function generateResourceId(): string {
  const name = uniqueNamesGenerator({
    dictionaries: [adjectives, colors, Math.random() < 0.5 ? pieces : animals],
    separator: '-',
    length: 3,
  });

  return `${name}-${square()}`;
}
