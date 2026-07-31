import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { GameResponseDto } from './dto/game-response.dto';
import { LegalMovesResponseDto } from './dto/legal-moves-response.dto';
import { MoveDto } from './dto/move.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { WrapMessage } from '../common/decorators/wrap-message.decorator';
import {
  ApiEnvelopeErrorResponse,
  ApiEnvelopeResponse,
} from '../common/decorators/api-envelope-response.decorator';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private gamesService: GamesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @WrapMessage('Game created')
  @ApiOperation({
    summary: 'Open a game and take one colour',
    description:
      'The creator takes the colour given in pieces, or one drawn at random when it is omitted. The other colour stays open until someone joins, which may be the creator again.',
  })
  @ApiEnvelopeResponse({
    status: HttpStatus.CREATED,
    description: 'Game created, waiting for the second player',
    type: GameResponseDto,
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'The colour or the time control is out of range',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, malformed or expired access token',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createGameDto: CreateGameDto,
  ): Promise<GameResponseDto> {
    return new GameResponseDto(
      await this.gamesService.create(user, createGameDto),
    );
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @WrapMessage('Game joined')
  @ApiOperation({
    summary: 'Take the open colour of a game',
    description:
      'Taking both colours is supported: the creator may join their own game and play each side in turn.',
  })
  @ApiParam({ name: 'id', example: 'brave-crimson-knight-e4' })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'Colour taken, the game is waiting for the first move',
    type: GameResponseDto,
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, malformed or expired access token',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No game carries this id',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.CONFLICT,
    description: 'The game already has both colours taken',
  })
  async join(
    @Param('id') resourceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GameResponseDto> {
    return new GameResponseDto(await this.gamesService.join(resourceId, user));
  }

  @Post(':id/move')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @WrapMessage('Move played')
  @ApiOperation({
    summary: 'Play a move in standard algebraic notation',
    description:
      'Legality is decided by the engine. A player holding both colours moves for whichever side has the turn.',
  })
  @ApiParam({ name: 'id', example: 'brave-crimson-knight-e4' })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'Move played, the game reflects the new position',
    type: GameResponseDto,
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'The move is missing or outside the accepted length',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, malformed or expired access token',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'The caller holds neither colour in this game',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No game carries this id',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.CONFLICT,
    description:
      'The game is not accepting moves, it is not the caller turn, or the game changed while the request was in flight',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    description: 'The notation is well formed but the move is not legal here',
  })
  async move(
    @Param('id') resourceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() moveDto: MoveDto,
  ): Promise<GameResponseDto> {
    return new GameResponseDto(
      await this.gamesService.move(resourceId, user, moveDto.move),
    );
  }

  @Get(':id/moves')
  @WrapMessage('Legal moves listed')
  @ApiOperation({
    summary: 'List every move that is legal in the current position',
  })
  @ApiParam({ name: 'id', example: 'brave-crimson-knight-e4' })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'The game and the moves available to the side to play',
    type: LegalMovesResponseDto,
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No game carries this id',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.CONFLICT,
    description: 'The game is not accepting moves',
  })
  async legalMoves(
    @Param('id') resourceId: string,
  ): Promise<LegalMovesResponseDto> {
    const { game, moves } = await this.gamesService.legalMoves(resourceId);

    return new LegalMovesResponseDto(game, moves);
  }

  @Post(':id/resign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @WrapMessage('Game resigned')
  @ApiOperation({
    summary: 'Give the game up',
    description:
      'A position that is already decided keeps its own result: resigning into a dead drawn position is recorded as the draw it already was.',
  })
  @ApiParam({ name: 'id', example: 'brave-crimson-knight-e4' })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'The game is finished',
    type: GameResponseDto,
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, malformed or expired access token',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'The caller holds neither colour in this game',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No game carries this id',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.CONFLICT,
    description: 'The game is already finished, or the clock had run out',
  })
  async resign(
    @Param('id') resourceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GameResponseDto> {
    return new GameResponseDto(
      await this.gamesService.resign(resourceId, user),
    );
  }

  @Post(':id/draw')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @WrapMessage('Draw offered')
  @ApiOperation({
    summary: 'Offer a draw, or accept the one on the table',
    description:
      'There is no separate route to accept. The offer is a flag per colour, and the game ends in a draw once both are raised.',
  })
  @ApiParam({ name: 'id', example: 'brave-crimson-knight-e4' })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'The offer is on the table, or the game ended in a draw',
    type: GameResponseDto,
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, malformed or expired access token',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'The caller holds neither colour in this game',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No game carries this id',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.CONFLICT,
    description: 'The game is already finished, or the clock had run out',
  })
  async offerDraw(
    @Param('id') resourceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GameResponseDto> {
    return new GameResponseDto(
      await this.gamesService.offerDraw(resourceId, user),
    );
  }

  @Delete(':id/draw')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @WrapMessage('Draw offer withdrawn')
  @ApiOperation({ summary: 'Take back your own draw offer' })
  @ApiParam({ name: 'id', example: 'brave-crimson-knight-e4' })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'The offer is off the table',
    type: GameResponseDto,
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, malformed or expired access token',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'The caller holds neither colour in this game',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No game carries this id',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.CONFLICT,
    description:
      'There is no offer of yours to withdraw, the game is finished, or the clock had run out',
  })
  async withdrawDraw(
    @Param('id') resourceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GameResponseDto> {
    return new GameResponseDto(
      await this.gamesService.withdrawDraw(resourceId, user),
    );
  }
}
