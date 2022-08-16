import { Body, Controller, Delete, Get, Request, Param, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { BoardsService } from '../boards.service';
import { newBoardDTO } from '../dto/boards.dto';

@Controller('boards')
export class BoardsController {
  constructor(
    private boardsService: BoardsService
  ) {}

  @Get('/')
  async getBoards() {
    const boards = await this.boardsService.findAll()
    return boards;
  }

  @Get('/:id')
  async getBoard(@Param('id') id: string) {
    const findBoard = await this.boardsService.findOne(id);
    return findBoard;
  }

  @Get('/:id/moves')
  getBoardMoves(@Param() params) {
    
  }

  @UseGuards(JwtAuthGuard)
  @Post('/')
  async createBoards(
    @Body(ValidationPipe) boardsDto: newBoardDTO,
    @Request() req,
    ): Promise<any> {
    const createdBoard = await this.boardsService.createNewBoard(boardsDto, req.user['user'])
    return createdBoard;
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/join')
  async joinBoards(@Param('id') id: string,@Request() req) {
    const boardJoined = await this.boardsService.joinBoard(id, req.user['user'])
    return boardJoined;
  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/move')
  move(@Param() params) {

  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/resign')
  resign(@Param() params) {

  }

  @UseGuards(JwtAuthGuard)
  @Post('/:id/draw')
  offerDraw(@Param() params) {

  }

  @UseGuards(JwtAuthGuard)
  @Delete('/:id/draw')
  cancelDraw(@Param() params) {

  }

}
