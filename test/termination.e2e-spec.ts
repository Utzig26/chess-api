import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';
import { createTestApp, TestApp } from './helpers/create-test-app';
import { Game, GameDocument } from '../src/games/schema/game.schema';

describe('Game termination (e2e)', () => {
  let app: INestApplication;
  let context: TestApp;
  let games: Model<GameDocument>;

  const timeControl = { white: 600, black: 600, increment: 5 };

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
    games = app.get(getModelToken(Game.name));
  });

  afterAll(async () => {
    await context?.close();
  });

  beforeEach(async () => {
    await context.reset();
  });

  const server = () => app.getHttpServer();

  const tokenFor = async (username: string): Promise<string> => {
    const { body } = await request(server())
      .post('/auth/signup')
      .send({ username, password: 'a-valid-password' })
      .expect(201);

    return body.data.accessToken;
  };

  const openTable = async () => {
    const white = await tokenFor('magnus');
    const black = await tokenFor('hikaru');

    const { body } = await request(server())
      .post('/games')
      .set('Authorization', `Bearer ${white}`)
      .send({ pieces: 'w', timeControl })
      .expect(201);

    await request(server())
      .post(`/games/${body.data.id}/join`)
      .set('Authorization', `Bearer ${black}`)
      .expect(200);

    return { id: body.data.id as string, white, black };
  };

  const resign = (token: string, id: string) =>
    request(server())
      .post(`/games/${id}/resign`)
      .set('Authorization', `Bearer ${token}`);

  const offerDraw = (token: string, id: string) =>
    request(server())
      .post(`/games/${id}/draw`)
      .set('Authorization', `Bearer ${token}`);

  const withdrawDraw = (token: string, id: string) =>
    request(server())
      .delete(`/games/${id}/draw`)
      .set('Authorization', `Bearer ${token}`);

  const play = (token: string, id: string, move: string) =>
    request(server())
      .post(`/games/${id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ move });

  const forcePosition = async (id: string, fen: string) => {
    const game = await games.findOne({ resourceId: id }).exec();
    if (!game) throw new Error('game vanished');

    game.pgn = `[SetUp "1"]\n[FEN "${fen}"]\n\n*`;
    await game.save();
  };

  describe('POST /games/:id/resign', () => {
    it('hands the win to the other side', async () => {
      const table = await openTable();

      const response = await resign(table.white, table.id).expect(200);

      expect(response.body.message).toBe('Game resigned');
      expect(response.body.data.status).toMatchObject({
        state: 'F',
        result: 'Black wins',
        additionalInfo: 'White resigned',
      });
      expect(response.body.data.status.finishedAt).toEqual(expect.any(String));
    });

    it('records black resigning', async () => {
      const table = await openTable();

      const response = await resign(table.black, table.id).expect(200);

      expect(response.body.data.status.result).toBe('White wins');
    });

    it('can be given away out of turn', async () => {
      const table = await openTable();
      await play(table.white, table.id, 'e4').expect(200);

      await resign(table.white, table.id).expect(200);
    });

    it('records a resignation into a dead position as the draw it already was', async () => {
      const table = await openTable();
      await forcePosition(table.id, '4k3/8/8/8/8/8/8/4K3 w - - 0 1');

      const response = await resign(table.white, table.id).expect(200);

      expect(response.body.data.status).toMatchObject({
        result: 'Draw',
        additionalInfo: 'Draw by insufficient material',
      });
    });

    it('rejects a resignation from someone who is not playing', async () => {
      const table = await openTable();
      const spectator = await tokenFor('fabiano');

      const response = await resign(spectator, table.id).expect(403);

      expect(response.body.message).toBe('You are not a player in this game');
    });

    it('rejects a second resignation', async () => {
      const table = await openTable();
      await resign(table.white, table.id).expect(200);

      await resign(table.black, table.id).expect(409);
    });

    it('rejects a game that does not exist', async () => {
      const token = await tokenFor('magnus');

      await resign(token, 'ghost-game-id-a1').expect(404);
    });

    it('rejects a resignation without a token', async () => {
      const table = await openTable();

      await request(server()).post(`/games/${table.id}/resign`).expect(401);
    });
  });

  describe('the draw is two flags, not a negotiation', () => {
    it('leaves the game running on a single offer', async () => {
      const table = await openTable();

      const response = await offerDraw(table.white, table.id).expect(200);

      expect(response.body.message).toBe('Draw offered');
      expect(response.body.data.status.state).toBe('W');
      expect(response.body.data.status.result).toBeNull();
    });

    it('does not end the game when the same side offers twice', async () => {
      const table = await openTable();

      await offerDraw(table.white, table.id).expect(200);
      const response = await offerDraw(table.white, table.id).expect(200);

      expect(response.body.data.status.state).toBe('W');
    });

    it('ends the game once both sides have offered', async () => {
      const table = await openTable();

      await offerDraw(table.white, table.id).expect(200);
      const response = await offerDraw(table.black, table.id).expect(200);

      expect(response.body.data.status).toMatchObject({
        state: 'F',
        result: 'Draw',
        additionalInfo: 'Draw by agreement',
      });
    });

    it('lets a side take its own offer back', async () => {
      const table = await openTable();
      await offerDraw(table.white, table.id).expect(200);

      const response = await withdrawDraw(table.white, table.id).expect(200);
      expect(response.body.message).toBe('Draw offer withdrawn');

      await offerDraw(table.black, table.id).expect(200);
      const stored = (await games.findOne({ resourceId: table.id }).exec())!;
      expect(stored.status.state).toBe('W');
    });

    it('rejects a withdrawal when nothing was offered', async () => {
      const table = await openTable();

      const response = await withdrawDraw(table.white, table.id).expect(409);

      expect(response.body.message).toBe('You have no draw offer to withdraw');
    });

    it('rejects a withdrawal of the other side offer', async () => {
      const table = await openTable();
      await offerDraw(table.white, table.id).expect(200);

      await withdrawDraw(table.black, table.id).expect(409);
    });

    it('rejects an offer from someone who is not playing', async () => {
      const table = await openTable();
      const spectator = await tokenFor('fabiano');

      await offerDraw(spectator, table.id).expect(403);
    });

    it('rejects an offer without a token', async () => {
      const table = await openTable();

      await request(server()).post(`/games/${table.id}/draw`).expect(401);
    });
  });

  describe('a finished game accepts nothing', () => {
    it.each([
      ['a move', (t: string, id: string) => play(t, id, 'e4')],
      ['a resignation', (t: string, id: string) => resign(t, id)],
      ['a draw offer', (t: string, id: string) => offerDraw(t, id)],
      ['a withdrawal', (t: string, id: string) => withdrawDraw(t, id)],
    ])('refuses %s', async (_case, act) => {
      const table = await openTable();
      await resign(table.white, table.id).expect(200);

      await act(table.black, table.id).expect(409);
    });
  });

  describe('playing yourself', () => {
    it('can resign against itself', async () => {
      const solo = await tokenFor('magnus');
      const { body } = await request(server())
        .post('/games')
        .set('Authorization', `Bearer ${solo}`)
        .send({ pieces: 'w', timeControl })
        .expect(201);
      await request(server())
        .post(`/games/${body.data.id}/join`)
        .set('Authorization', `Bearer ${solo}`)
        .expect(200);

      const response = await resign(solo, body.data.id).expect(200);

      expect(response.body.data.status.state).toBe('F');
      expect(response.body.data.status.result).toBe('Black wins');
    });

    it('can agree a draw with itself in two calls', async () => {
      const solo = await tokenFor('magnus');
      const { body } = await request(server())
        .post('/games')
        .set('Authorization', `Bearer ${solo}`)
        .send({ pieces: 'w', timeControl })
        .expect(201);
      await request(server())
        .post(`/games/${body.data.id}/join`)
        .set('Authorization', `Bearer ${solo}`)
        .expect(200);

      const first = await offerDraw(solo, body.data.id).expect(200);
      expect(first.body.data.status.state).toBe('W');

      const second = await offerDraw(solo, body.data.id).expect(200);
      expect(second.body.data.status).toMatchObject({
        state: 'F',
        result: 'Draw',
        additionalInfo: 'Draw by agreement',
      });
    });
  });
});
