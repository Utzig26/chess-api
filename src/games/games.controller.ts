import { 
  Body,
  Controller,
  Delete,
  Get,
  Request,
  Param,
  Post,
  UseGuards,
  ValidationPipe,
  HttpException,
  HttpStatus,
  Sse,
  ClassSerializerInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GamesService } from './games.service';
import { newGameDTO, moveDTO } from './dto/games.dto';
import { SSEService } from 'src/sse/sse.service';
import { Game } from './schemas/games.schema';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('games')
export class GamesController {
  constructor(
    private gamesService: GamesService,
    private sseService: SSEService
    ) {}
  
  @Sse(':id/sse')
  subscribeToGame(
    @Param('id') id: string
  ) {
    const game = this.gamesService.findOne(id)
    if(!game) 
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);

    return this.sseService.subscribe(id);
  }

  @Get('/')
  async getGames() {
    const games = await this.gamesService.findAll()
    return games.map( game => {
        return new Game(game.toObject());
      })
  }
  
  @Get(':id')
  async getGame(@Param('id') id: string){
    try{
      const game = await this.gamesService.findOne(id);
      return new Game(game.toObject());
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
    return {game: new Game(game.toObject()), moves: moves};
  }

  @UseGuards(JwtAuthGuard)
  @Post('/')
  async createGame(
      @Body(ValidationPipe) gamesDto: newGameDTO,
      @Request() req,
    ): Promise<Object> {
    const createdGame = await this.gamesService.createNewGame(gamesDto, req.user['user']);
    return new Game(createdGame.toObject());
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

    const gameJoined = await this.gamesService.joinGame(game, req.user['user'])
    
    this.sseService.emit(gameJoined.resourceId, {type:'join', game:new Game(gameJoined.toObject())})
    return new Game(gameJoined.toObject());
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
      throw new HttpException('Game is not playable.', HttpStatus.FORBIDDEN);
    
    let newGame = await this.gamesService.move(game, move)
    if(!newGame)
      throw new HttpException('Move is not possible.', HttpStatus.BAD_REQUEST);
    
    this.sseService.emit(newGame.resourceId, { type:'move', game:new Game(newGame.toObject()) })
    return new Game(newGame.toObject());
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

    if(!await this.gamesService.getGameStatus(game, 'resign')
    || !await this.gamesService.verifyPlayer(game, req.user['user'])){
      throw new HttpException('You can not resign.', HttpStatus.FORBIDDEN);
    }
    const newGame = await this.gamesService.resign(game, req.user['user'])
    
    this.sseService.emit(newGame.resourceId, { type:'resign', game:new Game(newGame.toObject()) })
    return new Game(newGame.toObject());
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/draw')
  async offerDraw(
    @Param('id') id: string,
    @Request() req,) {
    const game = await this.gamesService.findOne(id)
    if(!game) 
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);

    if(!await this.gamesService.getGameStatus(game, 'draw')
    || !await this.gamesService.verifyPlayer(game, req.user['user'])){
      throw new HttpException('You can not request a draw.', HttpStatus.FORBIDDEN);
    }

    const newGame = await this.gamesService.drawRequest(game, req.user['user'])
    
    this.sseService.emit(newGame.resourceId, { type:'drawOffer', game:new Game(newGame.toObject()) })
    return new Game(newGame.toObject());
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/:id/draw')
  async cancelDraw(
    @Param('id') id: string,
    @Request() req,) {
    const game = await this.gamesService.findOne(id)
    if(!game) 
      throw new HttpException('Game not found.', HttpStatus.NOT_FOUND);

    if(!await this.gamesService.getGameStatus(game, 'draw')
    || !await this.gamesService.verifyPlayer(game, req.user['user'])){
      throw new HttpException('You can not cancel a draw request.', HttpStatus.FORBIDDEN);
    }
    
    const newGame = await this.gamesService.drawCancel(game, req.user['user'])
    
    this.sseService.emit(newGame.resourceId, { type:'drawCancel', game:new Game(newGame.toObject()) })
    return new Game(newGame.toObject());
  }
}
