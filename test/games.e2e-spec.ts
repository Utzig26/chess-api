import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestApp } from './helpers/create-test-app';

describe('Games (e2e)', () => {
  let app: INestApplication;
  let context: TestApp;

  const timeControl = { white: 600, black: 600, increment: 5 };

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
  });

  afterAll(async () => {
    await context?.close();
  });

  beforeEach(async () => {
    await context.reset();
  });

  const server = () => app.getHttpServer();

  const tokenFor = async (username: string): Promise<string> => {
    const response = await request(server())
      .post('/auth/signup')
      .send({ username, password: 'a-valid-password' })
      .expect(201);

    return response.body.data.accessToken;
  };

  const createGame = (token: string, body: Record<string, unknown> = {}) =>
    request(server())
      .post('/games')
      .set('Authorization', `Bearer ${token}`)
      .send({ timeControl, ...body });

  const joinGame = (token: string, id: string) =>
    request(server())
      .post(`/games/${id}/join`)
      .set('Authorization', `Bearer ${token}`);

  describe('POST /games', () => {
    it('creates a game inside the response envelope', async () => {
      const token = await tokenFor('magnus');

      const response = await createGame(token, { pieces: 'w' }).expect(201);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 201,
        message: 'Game created',
      });
      expect(response.body.data).toMatchObject({
        whitePlayer: 'magnus',
        blackPlayer: null,
        turn: 'w',
        status: { state: 'WP', result: null, finishedAt: null },
        timeControl,
        history: [],
      });
    });

    it('starts from a complete fen, not just the piece placement', async () => {
      const token = await tokenFor('magnus');

      const { body } = await createGame(token, { pieces: 'w' }).expect(201);

      expect(body.data.fen).toBe(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      );
      expect(body.data.pgn).toBe('');
    });

    it('hands out a readable id', async () => {
      const token = await tokenFor('magnus');

      const { body } = await createGame(token).expect(201);

      expect(body.data.id).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[a-h][1-8]$/);
    });

    it('takes the colour the creator asked for', async () => {
      const token = await tokenFor('magnus');

      const { body } = await createGame(token, { pieces: 'b' }).expect(201);

      expect(body.data.blackPlayer).toBe('magnus');
      expect(body.data.whitePlayer).toBeNull();
    });

    it('draws a colour when none is given', async () => {
      const token = await tokenFor('magnus');

      const { body } = await createGame(token).expect(201);

      const seats = [body.data.whitePlayer, body.data.blackPlayer];
      expect(seats).toContain('magnus');
      expect(seats).toContain(null);
    });

    it('never leaks the player id', async () => {
      const token = await tokenFor('magnus');

      const response = await createGame(token).expect(201);

      expect(response.text).not.toMatch(/[0-9a-f]{24}/);
    });

    it('rejects a request without a token', async () => {
      await request(server()).post('/games').send({ timeControl }).expect(401);
    });

    it.each([
      ['a clock below the minimum', { white: 9, black: 600, increment: 5 }],
      ['a clock above the maximum', { white: 5401, black: 600, increment: 5 }],
      ['a black clock out of range', { white: 600, black: 9, increment: 5 }],
      ['an increment above ten', { white: 600, black: 600, increment: 11 }],
      ['a negative increment', { white: 600, black: 600, increment: -1 }],
      ['a fractional clock', { white: 600.5, black: 600, increment: 5 }],
      ['a missing increment', { white: 600, black: 600 }],
      ['a missing black clock', { white: 600, increment: 5 }],
    ])('rejects %s', async (_case, invalid) => {
      const token = await tokenFor('magnus');

      await createGame(token, { timeControl: invalid }).expect(400);
    });

    it('rejects a colour that is not w or b', async () => {
      const token = await tokenFor('magnus');

      await createGame(token, { pieces: 'green' }).expect(400);
    });

    it('rejects a missing time control', async () => {
      const token = await tokenFor('magnus');

      await request(server())
        .post('/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ pieces: 'w' })
        .expect(400);
    });

    it('rejects an unknown field', async () => {
      const token = await tokenFor('magnus');

      await createGame(token, { rated: true }).expect(400);
    });
  });

  describe('POST /games/:id/join', () => {
    it('fills the open colour and waits for the first move', async () => {
      const creator = await tokenFor('magnus');
      const challenger = await tokenFor('hikaru');
      const { body } = await createGame(creator, { pieces: 'w' }).expect(201);

      const response = await joinGame(challenger, body.data.id).expect(200);

      expect(response.body.message).toBe('Game joined');
      expect(response.body.data).toMatchObject({
        whitePlayer: 'magnus',
        blackPlayer: 'hikaru',
        status: {
          state: 'W',
          additionalInfo: 'Waiting for the first move',
        },
      });
    });

    it('lets the creator take both colours and play themselves', async () => {
      const creator = await tokenFor('magnus');
      const { body } = await createGame(creator, { pieces: 'w' }).expect(201);

      const response = await joinGame(creator, body.data.id).expect(200);

      expect(response.body.data).toMatchObject({
        whitePlayer: 'magnus',
        blackPlayer: 'magnus',
        status: { state: 'W' },
      });
    });

    it('rejects a second join once both colours are taken', async () => {
      const creator = await tokenFor('magnus');
      const challenger = await tokenFor('hikaru');
      const latecomer = await tokenFor('fabiano');
      const { body } = await createGame(creator, { pieces: 'w' }).expect(201);

      await joinGame(challenger, body.data.id).expect(200);

      const response = await joinGame(latecomer, body.data.id).expect(409);
      expect(response.body.message).toBe('This game is not joinable');
    });

    it('rejects a game that does not exist', async () => {
      const token = await tokenFor('magnus');

      const response = await joinGame(token, 'ghost-game-id-a1').expect(404);

      expect(response.body.message).toBe('Game not found');
    });

    it('rejects a request without a token', async () => {
      const creator = await tokenFor('magnus');
      const { body } = await createGame(creator).expect(201);

      await request(server()).post(`/games/${body.data.id}/join`).expect(401);
    });

    it('never leaks the player id', async () => {
      const creator = await tokenFor('magnus');
      const challenger = await tokenFor('hikaru');
      const { body } = await createGame(creator, { pieces: 'w' }).expect(201);

      const response = await joinGame(challenger, body.data.id).expect(200);

      expect(response.text).not.toMatch(/[0-9a-f]{24}/);
    });
  });
});
