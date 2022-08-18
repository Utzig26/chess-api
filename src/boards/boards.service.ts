import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { moveDTO, newBoardDTO } from './dto/boards.dto';
import { Boards } from './interfaces/boards.interface';
import { Users } from 'src/users/interfaces/users.interface';
import { uniqueNamesGenerator, NumberDictionary, Config, animals, colors, adjectives } from 'unique-names-generator'
import { Chess, Move } from 'chess.js/dist/chess'


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

  async findOne(id: string):Promise<Boards> {
    try{
      const board = await this.boardsModel.findOne({ resourceId: id });
      return board;
    }catch(error){
      throw new NotFoundException(error);
    }
  }

  async getPossibleMoves(id: string):Promise<any>{
    const board = new this.boardsModel(await this.findOne(id));
    const newBoard = new Chess(undefined, board.board)

    try{
      return [newBoard.moves()]
    }catch(error){
      throw new NotFoundException(error);
    }
  }
  async move(id: string, move: moveDTO):Promise<Boards>{
    let board = new this.boardsModel(await this.findOne(id));
    const newBoard = new Chess(undefined, board.board)
    try{
      console.log(move.move)
      console.log(newBoard.move(move.move))
      board.board = newBoard
      await board.save()
      return board
    }catch(error){
      throw new NotFoundException(error);
    }
  }
  async createNewBoard(boardDto: newBoardDTO, user: Users):Promise<Boards> {
    const {pieces, timeControl} = boardDto;
    
    //Create a cool resourceid
    let newResourceId:String;
    do {
      newResourceId = generateResourceId(); 
    } while (await this.boardsModel.findOne({ resourceId: newResourceId }));

    //Set the pieces. Randomize if the board creator don't chose one.
    let [whitePlayer, blackPlayer] = selectPieces(pieces, user['id'])
    
    //Overwrite `.white` && `.black` if `.both` has been defined.
    let [whiteControl, blackControl] = (
      timeControl.both?
        Array(2).fill(timeControl.both)
        :[timeControl.white,timeControl.black]
      );
    //const newBoards = new Chess()
    //newBoards.move('f3')
    //newBoards.move('e5')
    //newBoards.move('g4')
    //console.log("aaaa",newBoards)

    const newBoard = new this.boardsModel({
      resourceId: newResourceId,
      whitePlayer: whitePlayer,
      blackPlayer: blackPlayer,
      //board: newBoards,
      timeControl: {
        increment: timeControl.increment,
        white: whiteControl,
        black: blackControl,
      }
    })

    try {
      await newBoard.save();
      return newBoard;
      //return this.extractBoardData(newBoard);
    } catch (error) {
      throw new BadRequestException(error)
    }
  }

  async joinBoard(id: string, user: Users):Promise<any> {
    const userId = new mongoose.Schema.Types.ObjectId(user['id']);
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