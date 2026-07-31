import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PieceColor } from '../../chess/interfaces/chess.interface';

export class TimeControlDto {
  @ApiProperty({
    description: 'Seconds on the white clock',
    minimum: 10,
    maximum: 5400,
    example: 600,
  })
  @Max(5400)
  @Min(10)
  @IsInt()
  readonly white: number;

  @ApiProperty({
    description: 'Seconds on the black clock',
    minimum: 10,
    maximum: 5400,
    example: 600,
  })
  @Max(5400)
  @Min(10)
  @IsInt()
  readonly black: number;

  @ApiProperty({
    description: 'Fischer increment added after each move, in seconds',
    minimum: 0,
    maximum: 10,
    example: 5,
  })
  @Max(10)
  @Min(0)
  @IsInt()
  readonly increment: number;
}

export class CreateGameDto {
  @ApiPropertyOptional({
    description: 'Colour the creator takes. Drawn at random when omitted.',
    enum: ['w', 'b'],
    example: 'w',
  })
  @IsIn(['w', 'b'])
  @IsOptional()
  readonly pieces?: PieceColor;

  @ApiProperty({ type: TimeControlDto })
  @ValidateNested()
  @Type(() => TimeControlDto)
  @IsObject()
  readonly timeControl: TimeControlDto;
}
