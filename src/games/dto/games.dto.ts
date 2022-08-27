import {
  IsString,
  IsIn,
  IsOptional,
  Max,
  Min,
  IsNumber,
  ValidateNested,
  IsNotEmptyObject,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

const PIECES = ['w','b'];

class timeControl{
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  increment: number;
  
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(5400)
  black: number;

  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(5400)
  white: number;
}

export class newGameDTO {
  @IsOptional()
  @IsString()
  @IsIn(PIECES)
  pieces: string;

  @ValidateNested()
  @IsNotEmptyObject()
  @Type(() => timeControl)
  timeControl: timeControl;
}

export class moveDTO {
  @IsString()
  @Matches(/^([PNBRQK]?[a-h]?[1-8]?[xX-]?[a-h][1-8](=[NBRQ]| ?e\.p\.)?|^O-O(?:-O)?)[+#$]?$/, {message: 'Invalid move.'})
  move: string
}