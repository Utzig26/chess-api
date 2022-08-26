import { Body, Controller, Delete, Get, Request, Param, Post, UseGuards, ValidationPipe, BadRequestException, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GamesService } from '../games.service';
import { newGameDTO, moveDTO } from '../dto/games.dto';

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
  async getGame(@Param('id') id: string) {
    try{
      const game = await this.gamesService.findOne(id);
      return game;
    }catch(e){
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);
    }
  }
  
  @Get(':id/moves')
  async getGameMoves(@Param('id') id: string) {
    if(!await this.gamesService.getGameStatus(id, 'moves'))
      throw new HttpException('This game is not active.', HttpStatus.FORBIDDEN);
    
    try{
      const moves = await this.gamesService.getPossibleMoves(id);
      return moves;
    }catch(e){
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/')
  async createGame(
    @Body(ValidationPipe) gamesDto: newGameDTO,
    @Request() req,
    ): Promise<any> {
    const createdGame = await this.gamesService.createNewGame(gamesDto, req.user['user']);
    return this.gamesService.extractGameData(createdGame);
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/join')
  async joinGame(@Param('id') id: string,@Request() req) {
    if(!await this.gamesService.getGameStatus(id, 'join'))
      throw new HttpException('This game is no more joinable .', HttpStatus.FORBIDDEN);

    try{
      const gameJoined = await this.gamesService.joinGame(id, req.user['user'])
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
    if(!await this.gamesService.verifyPlayer(id, req.user['user']))
    throw new HttpException('You are not playing this game.', HttpStatus.FORBIDDEN);
    
    if(!await this.gamesService.verifyTurnPlayer(id, req.user['user']))
      throw new HttpException('It is not your turn.', HttpStatus.FORBIDDEN);

    if(!await this.gamesService.getGameStatus(id, 'move'))
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);
    
    const game = await this.gamesService.move(id, move)
    return game //this.gamesService.extractGameData(game);    
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/resign')
  async resign(
    @Param('id') id: string,
    @Request() req,
    ) {

    if(!await this.gamesService.verifyPlayer(id, req.user['user'])){
      throw new UnauthorizedException();
    }

    if(!await this.gamesService.getGameStatus(id, 'resign')){
      throw new BadRequestException();
    }
    const game = await this.gamesService.resign(id, req.user['user'])
    return game //this.gamesService.extractGameData(game); 
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/draw')
  async offerDraw(
    @Param('id') id: string,
    @Request() req,) {

    if(!await this.gamesService.verifyPlayer(id, req.user['user'])){
      throw new UnauthorizedException();
    }

    if(!await this.gamesService.getGameStatus(id, 'draw')){
      throw new BadRequestException();
    }

    const game = await this.gamesService.drawRequest(id, req.user['user'])
    return game //this.gamesService.extractGameData(game); 
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/:id/draw')
  async cancelDraw(
    @Param('id') id: string,
    @Request() req,) {

    if(!await this.gamesService.verifyPlayer(id, req.user['user'])){
      throw new UnauthorizedException();
    }

    if(!await this.gamesService.getGameStatus(id, 'draw')){
      throw new BadRequestException();
    }
    const game = await this.gamesService.drawCancel(id, req.user['user'])
    return game //this.gamesService.extractGameData(Game); 
}

}
