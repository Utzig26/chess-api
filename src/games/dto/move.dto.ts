import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class MoveDto {
  @ApiProperty({
    description:
      'The move in standard algebraic notation. Legality is decided by the engine, not by this shape.',
    minLength: 2,
    maxLength: 10,
    example: 'Nf3',
  })
  @Length(2, 10)
  @IsString()
  readonly move: string;
}
