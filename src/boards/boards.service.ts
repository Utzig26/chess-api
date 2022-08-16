import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { newBoardDTO } from './dto/boards.dto';
import { Boards } from './interfaces/boards.interface';
import { Users } from 'src/users/interfaces/users.interface';
import {uniqueNamesGenerator, NumberDictionary, Config, animals, colors, adjectives} from 'unique-names-generator'

const initalFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'

@Injectable()
export class BoardsService {
  constructor(
    @InjectModel('Boards') private boardsModel: Model<Boards>
  ) {}

  async findAll():Promise<any> {
    const boards = await this.boardsModel.find({ status:{gameState: 'A'}})
    let prettyBoards = [];
    for(const e of boards){
      prettyBoards.push(this.extractBoardData(new this.boardsModel(e)))
    };
    return prettyBoards;
  }
  async findOne(id: string):Promise<any> {
    try{
      const board = await this.boardsModel.findOne({ resourceId: id });
      return board;
    }catch(error){
      throw new NotFoundException(error);
    }
  }
  async createNewBoard(boardDto: newBoardDTO, user: Users):Promise<any> {
    const {pieces, timeControl} = boardDto;

    let newResourceId:String;
    while(newResourceId == null || await this.boardsModel.findOne({ resourceId: newResourceId })){
      newResourceId = generateResourceId(); //create a cool resourceid
    }

    let [whitePlayer, blackPlayer] = selectPieces(pieces,user['id'])

    let [whiteControl, blackControl] = [timeControl.white,timeControl.black];
    if(timeControl.both) //Overwrite `.white` && `.black` if `.both` has been defined 
    [whiteControl, blackControl] = Array(2).fill(timeControl.both);
    
    const newBoard = new this.boardsModel({
      resourceId: newResourceId,
      FEN: initalFEN,
      whitePlayer: whitePlayer,
      blackPlayer: blackPlayer,
      timeControl: {
        increment: timeControl.increment,
        white: whiteControl,
        black: blackControl
      },
    })

    try {
      await newBoard.save();
      return this.extractBoardData(newBoard);
    } catch (error) {
      throw new BadRequestException(error)
    }
  }
  async joinBoard(id: string, user: Users):Promise<any> {
    const userId = new mongoose.Types.ObjectId(user['id']);
    let board = await this.findOne(id);
    if(board.whitePlayer == null){board.whitePlayer = userId;}
    else if(board.blackPlayer == null){board.blackPlayer = userId;}
    else{throw new UnauthorizedException();}
    try {
      await board.save();
      return this.extractBoardData(board);
    } catch (error) {
      throw new BadRequestException(error)
    }
  }

  extractBoardData(board: Boards) {
    const prettyBoard ={
      id: board['resourceId'],
      blackPlayer: board['blackPlayer'],
      whitePlayer: board['whitePlayer'],
      FEN: board['FEN'],
      PGN: board['PGN'],
      timecontrol: board['timeControl'],
      status: board['status'],
      drawOffer: board['drawOffer'],
    }
    return prettyBoard;
  }
}


function selectPieces(pieces, id){
  const objectId = new mongoose.Types.ObjectId(id);

  if (pieces) pieces = pieces.toLowerCase();
  if (pieces =='white') pieces = 'w';
  else if (pieces =='black') pieces = 'b';

  switch (pieces) {
    case 'w':
      return [objectId, null]
    case 'b':
      return [null, objectId]
    default:
      const blackOrWhite = [[null, objectId], [objectId, null]]
      return blackOrWhite[Math.floor(2*Math.random())];
  }
}

function generateResourceId(){
  const numbers = NumberDictionary.generate({ min: 1, max: 8 });
  const characters = ['a','b','c','d','e','f','g','h'];
  const noums = [['pawn','bishop','knight','rook','queen','king'], animals];
  const configPos: Config ={
    dictionaries: [characters,numbers],
    separator:'',
    style:'lowerCase'
  }
  const config: Config = {
    dictionaries: [
      adjectives,
      colors,
      noums[Math.floor(2*Math.random())],
    ],
    length:3,
    separator:'-',
    style:'lowerCase'
  }
  return uniqueNamesGenerator(config)+'-'+uniqueNamesGenerator(configPos);
}