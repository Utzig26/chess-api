import { Body, Controller, Delete, Get, Request, Param, Post, UseGuards, ValidationPipe, BadRequestException, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GamesService } from '../games.service';
import { newGameDTO, moveDTO } from '../dto/games.dto';
import { Games } from '../interfaces/games.interface';

@Controller('games')
export class GamesController {
  constructor(
    private gamesService: GamesService
  ) {}

  @Get('/')
  async getGames() {
    const games = await this.gamesService.findAll()
    return games;
  }
  
  @Get(':id')
  async getGame(
      @Param('id') id: string
    ){
    try{
      const game = await this.gamesService.findOne(id);
      return game;
    }catch(e){
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);
    }
  }
  
  @Get(':id/moves')
  async getGameMoves(
      @Param('id') id: string
    ){
    const game = await this.gamesService.findOne(id)
    if(!game) 
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);

    if(!await this.gamesService.getGameStatus(game, 'moves'))
      throw new HttpException('This game is not active.', HttpStatus.FORBIDDEN);
    
    const moves = await this.gamesService.getPossibleMoves(game);
    return moves;
  }

  @UseGuards(JwtAuthGuard)
  @Post('/')
  async createGame(
      @Body(ValidationPipe) gamesDto: newGameDTO,
      @Request() req,
    ): Promise<Object> {
    const createdGame = await this.gamesService.createNewGame(gamesDto, req.user['user']);
    return this.gamesService.extractGameData(createdGame);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/join')
  async joinGame(
      @Param('id') id: string,
      @Request() req
    ): Promise<Object> {
    const game = await this.gamesService.findOne(id)
    if(!game) 
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);

    if(!await this.gamesService.getGameStatus(game, 'join'))
      throw new HttpException('This game is no more joinable .', HttpStatus.FORBIDDEN);

    try{
      const gameJoined = await this.gamesService.joinGame(game, req.user['user'])
      return this.gamesService.extractGameData(gameJoined);
    }catch(e){
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/move')
  async move(
    @Body(ValidationPipe) move: moveDTO,
    @Param('id') id: string,
    @Request() req,
    ) {
    const game = await this.gamesService.findOne(id)
    if(!game) 
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);

    if(!await this.gamesService.verifyPlayer(game, req.user['user']))
      throw new HttpException('You are not playing this game.', HttpStatus.FORBIDDEN);
    
    if(!await this.gamesService.verifyTurnPlayer(game, req.user['user']))
      throw new HttpException('It is not your turn.', HttpStatus.FORBIDDEN);

    if(!await this.gamesService.getGameStatus(game, 'move'))
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);
    
    const newGame = await this.gamesService.move(game, move)
    return newGame //this.gamesService.extractGameData(game);    
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/resign')
  async resign(
    @Param('id') id: string,
    @Request() req,
    ) {
      const game = await this.gamesService.findOne(id)
      if(!game) 
        throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);
    if(!await this.gamesService.verifyPlayer(game, req.user['user'])){
      throw new UnauthorizedException();
    }

    if(!await this.gamesService.getGameStatus(game, 'resign')){
      throw new BadRequestException();
    }
    const newGame = await this.gamesService.resign(game, req.user['user'])
    return newGame //this.gamesService.extractGameData(game); 
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/draw')
  async offerDraw(
    @Param('id') id: string,
    @Request() req,) {
    const game = await this.gamesService.findOne(id)
    if(!game) 
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);

    if(!await this.gamesService.verifyPlayer(game, req.user['user'])){
      throw new UnauthorizedException();
    }

    if(!await this.gamesService.getGameStatus(game, 'draw')){
      throw new BadRequestException();
    }

    const newGame = await this.gamesService.drawRequest(game, req.user['user'])
    return newGame //this.gamesService.extractGameData(game); 
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/:id/draw')
  async cancelDraw(
    @Param('id') id: string,
    @Request() req,) {
    const game = await this.gamesService.findOne(id)
    if(!game) 
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);
    if(!await this.gamesService.verifyPlayer(game, req.user['user'])){
      throw new UnauthorizedException();
    }

    if(!await this.gamesService.getGameStatus(game, 'draw')){
      throw new BadRequestException();
    }
    const newGame = await this.gamesService.drawCancel(game, req.user['user'])
    return newGame //this.gamesService.extractGameData(Game); 
  }
}
