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

const PIECES = ['w','b','white','black'];

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

  @IsOptional() //it overwrite white and black attribute
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(5400)
  both: number
}

export class newBoardDTO {
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