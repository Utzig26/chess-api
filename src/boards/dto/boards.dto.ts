import {
  IsString,
  
  IsIn,
  IsOptional,
  Max,
  Min,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const PIECES = ['w','b','white','black'];

export class timeControl{
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
  @Type(() => timeControl)
  timeControl: timeControl;
}