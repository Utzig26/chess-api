import { BadRequestException, Injectable, Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, ObjectId } from 'mongoose';
import { moveDTO, newGameDTO } from './dto/games.dto';
import { Games } from './interfaces/games.interface';
import { Users } from 'src/users/interfaces/users.interface';
import { uniqueNamesGenerator, NumberDictionary, Config, animals, colors, adjectives } from 'unique-names-generator'
import { Chess, Move } from 'chess.js/dist/chess'
import { UsersService } from 'src/users/users.service';
//import { SSEService } from 'src/sse/sse.service';


@Injectable()
export class GamesService {
  // @Inject(SSEService)
  // private sseService: SSEService;

  constructor(
    @InjectModel('Games') private gamesModel: Model<Games>
  ) {}

  async findAll():Promise<Games[]> {
    return await this.gamesModel.find({ "status.gameState": "A"}).exec();
  }

  async findOne(id: string):Promise<Games> {
    return await this.gamesModel.findOne({ "resourceId": id }).exec();
  }

  async getPossibleMoves(game: Games):Promise<(string[]|Move[])>{
    const newBoard = new Chess(game.board);
    return newBoard.moves();
  }

  async move(game: Games, moveRequest: moveDTO):Promise<Games>{
    const newBoard = new Chess(game.board);
    const move = newBoard.move(moveRequest.move) 
    if(!move)
      return null
      
    game.FEN = newBoard.fen();
    game.PGN.push({
      moveNumber: game.moveNumber,
      move: move.san,
      timestemp: Date.now()
    })
    game = updateTimeControl(game);
    game.turn = newBoard.turn();
    if(game.turn == 'b')
      game.moveNumber += 1;
    game.board = newBoard;
    game = updateStatus(game, 'move');
    await game.save();
    return game;
  }
  
  async createNewGame(gameDto: newGameDTO, user: Users):Promise<Games> {
    const {pieces, timeControl} = gameDto;
    
    //Create a cool resourceid
    let newResourceId:String;
    do newResourceId = generateResourceId(); 
    while (await this.gamesModel.findOne({ resourceId: newResourceId }).exec());
    
    //Set the pieces. Randomize if the game creator don't chose one.
    let [whitePlayer, blackPlayer] = selectPieces(pieces, user)

    const newGame = new this.gamesModel({
      resourceId: newResourceId,
      whitePlayer: whitePlayer,
      blackPlayer: blackPlayer,
      timeControl: timeControl,
    })
    return await newGame.save();
  }

  async joinGame(game: Games, user: Users):Promise<Games> {
    const player = {
      id: user['id'],
      username: user['username'],
    }
    
    if(game.whitePlayer.id === undefined)game.whitePlayer = player;
    else if(game.blackPlayer.id === undefined)game.blackPlayer = player;
    
    game = updateStatus(game,'join');
    return await game.save();
  }

  async resign(game: Games, player:Users):Promise<Games>{
    game.resignRequest.player = wichPlayer(game, player);
    game.resignRequest.timeStemp = Date.now()
    game = updateStatus(game, 'resign');
    game = await this.clock(game, game.resignRequest.timeStemp)
    return await game.save();
  }

  async drawRequest(game: Games, player:Users):Promise<Games>{
    const playerColor = wichPlayer(game, player);
    
    if(playerColor == 'w')
      game.drawOffer.white = true;

    if(playerColor == 'b')
      game.drawOffer.black = true;

    if(playerColor == 'wb')
      game.drawOffer.white = game.drawOffer.black = true;

      if(game.drawOffer.black && game.drawOffer.white)
      game = updateStatus(game, 'draw');
      
    game = await this.clock(game, Date.now())
    return await game.save();
  }

  async drawCancel(game: Games, player:Users):Promise<Games>{
    const playerColor = wichPlayer(game, player);

    if(playerColor == 'w')
      game.drawOffer.white = false;
    if(playerColor == 'b')
      game.drawOffer.black = false;
    
    game = await this.clock(game, Date.now())
    return await game.save();
  }

  async getGameStatus(game:Games, type: string):Promise<Boolean> {
    const state = game.status.gameState;
    
    if(state == 'F')
      return false;

    if(type === 'join')
      return (state == 'WP');
    
    if(type == 'move' || type ==  'moves' || type == 'resign' || type == 'draw')
      return (state == 'W' || state == 'A');
    return false
  }

  async verifyTurnPlayer(game: Games, player:Users):Promise<boolean>{
    if(game.turn == 'w')
      return (player['id'] == game.whitePlayer.id);
    else
      return (player['id'] == game.blackPlayer.id);
  }

  async verifyPlayer(game: Games, player:Users):Promise<boolean>{
    return (player['id'] == game.whitePlayer.id || player['id'] == game.blackPlayer.id);
  }

  async clock(game: Games, time: number): Promise<Games>{
    const moves = game.PGN.slice(-2)
    
    if(moves.length === 0)
      return game;

    const timeDifference = (time - moves[0].timestemp)/1000;
    const timeRemaining = game.timeControl.turnTime - timeDifference;

    if(game.turn == 'w'){
      if(timeRemaining <= 0){
        game.timeControl.white = 0;
        game = updateStatus(game, 'timedOut');
      }else{
        game.timeControl.white = timeRemaining
      }
    }else if(game.turn == 'b'){
      if(timeRemaining <= 0){
        game.timeControl.black = 0;
        game = updateStatus(game, 'timedOut');
      }else{
        game.timeControl.black = timeRemaining
      }
    }
    return await game.save();
  }
}

function wichPlayer(game: Games, player:Users){
  if(game.whitePlayer.id == player['id'] && game.blackPlayer.id == player['id'])
    return 'wb';
  else if(game.whitePlayer.id == player['id'])
    return 'w';
  else if(game.blackPlayer.id == player['id'])
    return 'b';
}

function updateTimeControl(game: Games){
  const moves = game.PGN.slice(-2)
  
  if (moves.length === 1){
    game.timeControl.turnTime = game.timeControl.black;
    return game;
  }

  const timeSpent = game.timeControl.increment - (moves[1].timestemp - moves[0].timestemp) / 1000;

  if(game.turn == 'w'){
    game.timeControl.white += parseFloat(timeSpent.toFixed(3));
    game.timeControl.turnTime = game.timeControl.black;
  }else{
    game.timeControl.black += parseFloat(timeSpent.toFixed(3));
    game.timeControl.turnTime = game.timeControl.white;
  }
  
  return game;
}

function updateStatus(game: Games, type: string){
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

    case 'draw':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in draw by Mutual Agreement'
      game.status.finishedAt = Date.now()
      game.status.result = 'Draw'
      break;

    case 'insufficientMaterial':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in draw by insufficient material.'
      game.status.finishedAt = Date.now()
      game.status.result = 'Draw'
      break;

    case 'stalemate':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in draw by stalemate.'
      game.status.finishedAt = Date.now()
      game.status.result = 'Draw'
      break;

    case 'threefoldRepetition':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in draw by threefold repetition.'
      game.status.finishedAt = Date.now()
      game.status.result = 'Draw'
      break;

    case '50-moveRule':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in draw by 50-move rule.'
      game.status.finishedAt = Date.now()
      game.status.result = 'Draw'
      break;

    case 'checkMate':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in check mate.'
      game.status.finishedAt = Date.now()
      game.status.result = (game.turn=='w')?'Black wins':'White wins';
      break;

    case 'resign':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over in resign'
      game.status.finishedAt = Date.now()
      if(game.resignRequest.player != 'wb')
        game.status.result = (game.resignRequest.player=='w')?'Black wins':'White wins';
      break;

    case 'timedOut':
      game.status.gameState = 'F'
      game.status.aditionalInfo = 'This match is over due time out.'
      game.status.finishedAt = Date.now()
      game.status.result = (game.turn=='w')?'Black wins':'White wins';
      break;

    default:
      break;
  }

  return game;
}

function selectPieces(pieces, user){
  const player ={
    id: user['id'],
    username: user['username'],
  };

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
