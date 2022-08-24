import { BadRequestException, Injectable, Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, ObjectId } from 'mongoose';
import { moveDTO, newBoardDTO } from './dto/boards.dto';
import { Boards } from './interfaces/boards.interface';
import { Users } from 'src/users/interfaces/users.interface';
import { uniqueNamesGenerator, NumberDictionary, Config, animals, colors, adjectives } from 'unique-names-generator'
import { Chess, Move } from 'chess.js/dist/chess'
import { UsersService } from 'src/users/users.service';


@Injectable()
export class BoardsService {
  @Inject(UsersService)
  private readonly usersService: UsersService;

  constructor(
    @InjectModel('Boards') private boardsModel: Model<Boards>
  ) {}

  async findAll():Promise<any> {
    const boards = await this.boardsModel.find({ "status.gameState": 'A'}).exec()
    return boards;
  }

  async findOne(id: string):Promise<Boards> {
    try{
      const board = await this.boardsModel.findOne({ "resourceId": id }).exec();
      return board;
    }catch(error){
      throw new NotFoundException(error);
    }
  }

  async getPossibleMoves(id: string):Promise<(string[]|Move[])[]>{
    const board = new this.boardsModel(await this.findOne(id));
    const newBoard = new Chess(board.board)
    try{
      return [newBoard.moves()]
    }catch(error){
      throw new NotFoundException(error);
    }
  }

  async move(id: string, move: moveDTO):Promise<Boards>{
    let board = await this.findOne(id);
    const newBoard = new Chess(board.board)
    
    try{
      if(newBoard.move(move.move)){
        board.FEN = newBoard.fen()
        board.turn = newBoard.turn()
        board.moveNumber = (board.turn == 'b')?board.moveNumber+1:board.moveNumber;
        board.PGN.push(
          {
            moveNumber: board.moveNumber, 
            move: move.move, 
            timestamp: Date.now()
          })
        board.board = newBoard
        board = updateStatus(board, 'move')
        board = updateTime(board)
        await board.save()
        return board
      }else{
        throw new BadRequestException('Move is not possible.');
      }
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
    } while (await this.boardsModel.findOne({ resourceId: newResourceId }).exec());
    //Set the pieces. Randomize if the board creator don't chose one.
    let [whitePlayer, blackPlayer] = selectPieces(pieces, user)
    
    //Overwrite `.white` && `.black` if `.both` has been defined.
    let [whiteControl, blackControl] = (
      timeControl.both?
        Array(2).fill(timeControl.both)
        :[timeControl.white,timeControl.black]
      );

    const newBoard = new this.boardsModel({
      resourceId: newResourceId,
      whitePlayer: whitePlayer,
      blackPlayer: blackPlayer,
      timeControl: {
        increment: timeControl.increment,
        white: whiteControl,
        black: blackControl,
      }
    })

    try {
      await newBoard.save();
      return newBoard;
    } catch (error) {
      throw new BadRequestException(error)
    }
  }

  async joinBoard(id: string, user: Users):Promise<Boards> {
    const userId:ObjectId = user['id'];
    const player = {
      id: userId,
      username: user['username'],
    }
    let board = await this.findOne(id);
    if(board.whitePlayer.id === undefined){board.whitePlayer = player;}
    else if(board.blackPlayer.id === undefined){board.blackPlayer = player;}
    else{throw new UnauthorizedException();}
    board = updateStatus(board,'join');
    try {
      await board.save();
      return board;
    } catch (error) {
      throw new BadRequestException(error)
    }
  }

  extractBoardData(board: Boards) {
    const prettyBoard ={
      id: board['resourceId'],
      blackPlayer: board['blackPlayer']['username'],
      whitePlayer: board['whitePlayer']['username'],
      FEN: board['FEN'],
      PGN: board['PGN'],
      timecontrol: board['timeControl'],
      status: board['status'],
      drawOffer: board['drawOffer'],
      turn: board['turn'],
    }
    return prettyBoard;
  }

  async getGameStatus(id:string, type: string):Promise<Boolean> {
    const board = await this.findOne(id);
    const state = board.status.gameState;
    
    if(state == 'F')
      return false;

    if(type === 'join')
      return (state == 'WP')?true:false;
    
    if(type == 'move' || type ==  'moves' || type == 'resign' || type == 'draw')
      return (state == 'W' || state == 'A')?true:false;
      return false
  }

  async verifyTurnPlayer(id: string, player:Users):Promise<boolean>{
    const game = await this.findOne(id);
    if(game.turn == 'w')
      return (player['id'] == game.whitePlayer.id);
    else
      return (player['id'] == game.blackPlayer.id);
  }

  async verifyPlayer(id: string, player:Users):Promise<boolean>{
    const game = await this.findOne(id);
      return (
        player['id'] == game.whitePlayer.id 
        || player['id'] == game.blackPlayer.id 
      );
  }

  async resign(id: string, player:Users):Promise<Boards>{
    let game = await this.findOne(id);
    game = updateStatus(game, 'resign');
    try {
      await game.save();
      return game;
    } catch (error) {
      throw new BadRequestException(error)
    }
  }

  async drawRequest(id: string, player:Users):Promise<Boards>{
    let game = await this.findOne(id);
    const playerColor = wichPlayer(game, player);

    if(playerColor == 'w')
      game.drawOffer.white = true;

    if(playerColor == 'b')
      game.drawOffer.black = true;

    if(playerColor == 'wb')
      game.drawOffer.white = game.drawOffer.black = true;

    if(game.drawOffer.black && game.drawOffer.white)
      game = updateStatus(game, 'draw');
    
    try {
      await game.save();
      return game;
    } catch (error) {
      throw new BadRequestException(error)
    }
  }

  async drawCancel(id: string, player:Users):Promise<Boards>{
    let game = await this.findOne(id);
    const playerColor = wichPlayer(game, player);
    console.log(playerColor)
    if(playerColor == 'w')
      game.drawOffer.white = false;
    if(playerColor == 'b')
      game.drawOffer.black = false;
    
      try {
      await game.save();
      return game;
    } catch (error) {
      throw new BadRequestException(error)
    }
  }
}

function wichPlayer(game: Boards, player:Users){
  if(game.whitePlayer.id == player['id'] && game.blackPlayer.id == player['id'])
    return 'wb';
  else if(game.whitePlayer.id == player['id'])
    return 'w';
  else if(game.blackPlayer.id == player['id'])
    return 'b';
}

function updateTime(board: Boards){
  const moves = board.PGN.slice(-2)
  if (moves.length === 1){return board;}
  
  const timeSpent = board.timeControl.increment - (moves[1].timestamp - moves[0].timestamp);

  (board.turn == 'w')?
  board.timeControl.white += timeSpent:
  board.timeControl.black += timeSpent;
  return board;
}

function updateStatus(game: Boards, type:string){
  const board = new Chess(game.board)
  if(board.isCheckmate())
    type = 'checkMate';
  else if(board.isInsufficientMaterial())
    type = 'insufficientMaterial';
  else if(board.isStalemate())
    type = 'stalemate';
  else if(board.isThreefoldRepetition())
    type = 'threefoldRepetition'; 
  else if(board.isDraw()) //need to fix 50-move rule
    type = '50-moveRule';
  
  switch (type) {
    case 'join':
      game.status.gameState = 'W'
      game.status.aditionalInfo = 'Wating for the first move.'
      break;

    case 'move':
      game.status.gameState = 'A'
      game.status.aditionalInfo = 'This match is on.'
      break;

    case 'resign':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in resign'
      game.status.finishedAt = Date.now()
      break;

    case 'draw':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in draw by Mutual Agreement'
      game.status.finishedAt = Date.now()
      break;

    case 'insufficientMaterial':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in draw by insufficient material.'
      game.status.finishedAt = Date.now()
      break;

    case 'stalemate':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in draw by stalemate.'
      game.status.finishedAt = Date.now()
      break;

    case 'threefoldRepetition':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in draw by threefold repetition'
      game.status.finishedAt = Date.now()
      break;

    case '50-moveRule':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in draw by 50-move rule'
      game.status.finishedAt = Date.now()
      break;

    case 'checkMate':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in check mate.'
      game.status.finishedAt = Date.now()
      break;

    default:
      break;
  }

  return game;
}


function selectPieces(pieces, user){
  const objectId = new mongoose.Types.ObjectId(user['id']);
  const player ={
    id: objectId,
    username: user['username'],
  };

  if (pieces) pieces = pieces.toLowerCase();
  if (pieces =='white') pieces = 'w';
  else if (pieces =='black') pieces = 'b';

  switch (pieces) {
    case 'w':
      return [player, null]
    case 'b':
      return [null, player]
    default:
      const blackOrWhite = [[null, player], [player, null]]
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
