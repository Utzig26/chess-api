import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestApp } from './helpers/create-test-app';

describe('Moves (e2e)', () => {
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
    const { body } = await request(server())
      .post('/auth/signup')
      .send({ username, password: 'a-valid-password' })
      .expect(201);

    return body.data.accessToken;
  };

  const play = (token: string, id: string, move: string) =>
    request(server())
      .post(`/games/${id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ move });

  interface Table {
    id: string;
    white: string;
    black: string;
  }

  const openTable = async (): Promise<Table> => {
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

    return { id: body.data.id, white, black };
  };

  describe('POST /games/:id/move', () => {
    it('plays a move and hands the turn over', async () => {
      const table = await openTable();

      const response = await play(table.white, table.id, 'e4').expect(200);

      expect(response.body.message).toBe('Move played');
      expect(response.body.data).toMatchObject({
        turn: 'b',
        status: { state: 'A', additionalInfo: 'Game in progress' },
      });
      expect(response.body.data.history).toEqual([
        { san: 'e4', moveNumber: 1, timestamp: expect.any(String) },
      ]);
    });

    it('advances the position on every move', async () => {
      const table = await openTable();

      await play(table.white, table.id, 'e4').expect(200);
      const response = await play(table.black, table.id, 'e5').expect(200);

      expect(response.body.data.fen).toBe(
        'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      );
      expect(response.body.data.pgn).toContain('e4');
      expect(response.body.data.pgn).toContain('e5');
      expect(response.body.data.history).toHaveLength(2);
    });

    it('runs a whole game through to mate', async () => {
      const table = await openTable();

      await play(table.white, table.id, 'f3').expect(200);
      await play(table.black, table.id, 'e5').expect(200);
      await play(table.white, table.id, 'g4').expect(200);
      const mate = await play(table.black, table.id, 'Qh4#').expect(200);

      expect(mate.body.data.status).toMatchObject({
        state: 'F',
        result: 'Black wins',
        additionalInfo: 'Checkmate',
      });
      expect(mate.body.data.status.finishedAt).toEqual(expect.any(String));
    });

    it('refuses to move once the game is finished', async () => {
      const table = await openTable();

      await play(table.white, table.id, 'f3').expect(200);
      await play(table.black, table.id, 'e5').expect(200);
      await play(table.white, table.id, 'g4').expect(200);
      await play(table.black, table.id, 'Qh4#').expect(200);

      const response = await play(table.white, table.id, 'e4').expect(409);
      expect(response.body.message).toBe('This game is not accepting moves');
    });

    it('rejects a move from someone who is not playing', async () => {
      const table = await openTable();
      const spectator = await tokenFor('fabiano');

      const response = await play(spectator, table.id, 'e4').expect(403);

      expect(response.body.message).toBe('You are not a player in this game');
    });

    it('rejects a move out of turn', async () => {
      const table = await openTable();

      const response = await play(table.black, table.id, 'e5').expect(409);

      expect(response.body.message).toBe('It is not your turn');
    });

    it('rejects a move that is not legal in this position', async () => {
      const table = await openTable();

      const response = await play(table.white, table.id, 'e5').expect(422);

      expect(response.body.message).toBe('Illegal move');
    });

    it('rejects a move in a game still waiting for a second player', async () => {
      const white = await tokenFor('magnus');
      const { body } = await request(server())
        .post('/games')
        .set('Authorization', `Bearer ${white}`)
        .send({ pieces: 'w', timeControl })
        .expect(201);

      await play(white, body.data.id, 'e4').expect(409);
    });

    it('rejects a move in a game that does not exist', async () => {
      const token = await tokenFor('magnus');

      await play(token, 'ghost-game-id-a1', 'e4').expect(404);
    });

    it('rejects a move without a token', async () => {
      const table = await openTable();

      await request(server())
        .post(`/games/${table.id}/move`)
        .send({ move: 'e4' })
        .expect(401);
    });

    it.each([
      ['an empty move', ''],
      ['a single character', 'e'],
      ['notation past the accepted length', 'e4e5e6e7e8e9'],
    ])('rejects %s with a bad request', async (_case, move) => {
      const table = await openTable();

      await play(table.white, table.id, move).expect(400);
    });

    it('rejects an unknown field in the body', async () => {
      const table = await openTable();

      await request(server())
        .post(`/games/${table.id}/move`)
        .set('Authorization', `Bearer ${table.white}`)
        .send({ move: 'e4', promoteTo: 'q' })
        .expect(400);
    });

    it('lets a player holding both colours move each side', async () => {
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

      await play(solo, body.data.id, 'e4').expect(200);
      const response = await play(solo, body.data.id, 'e5').expect(200);

      expect(response.body.data.history).toHaveLength(2);
      expect(response.body.data.turn).toBe('w');
    });
  });

  describe('simultaneous moves', () => {
    it('lets exactly one of two racing requests through', async () => {
      const table = await openTable();

      const [first, second] = await Promise.all([
        play(table.white, table.id, 'e4'),
        play(table.white, table.id, 'd4'),
      ]);

      const statuses = [first.status, second.status].sort();
      expect(statuses).toEqual([200, 409]);

      const { body } = await request(server())
        .get(`/games/${table.id}/moves`)
        .expect(200);
      expect(body.data.game.history).toHaveLength(1);
    });
  });

  describe('GET /games/:id/moves', () => {
    it('lists the twenty opening moves without a token', async () => {
      const table = await openTable();

      const response = await request(server())
        .get(`/games/${table.id}/moves`)
        .expect(200);

      expect(response.body.message).toBe('Legal moves listed');
      expect(response.body.data.moves).toHaveLength(20);
      expect(response.body.data.game.id).toBe(table.id);
    });

    it('narrows the list as the position develops', async () => {
      const table = await openTable();
      await play(table.white, table.id, 'e4').expect(200);

      const response = await request(server())
        .get(`/games/${table.id}/moves`)
        .expect(200);

      expect(response.body.data.moves).toContain('e5');
      expect(response.body.data.moves).not.toContain('e4');
    });

    it('rejects a game that does not exist', async () => {
      await request(server()).get('/games/ghost-game-id-a1/moves').expect(404);
    });

    it('rejects a game still waiting for a second player', async () => {
      const token = await tokenFor('magnus');
      const { body } = await request(server())
        .post('/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ timeControl })
        .expect(201);

      await request(server()).get(`/games/${body.data.id}/moves`).expect(409);
    });

    it('never leaks the player id', async () => {
      const table = await openTable();

      const response = await request(server())
        .get(`/games/${table.id}/moves`)
        .expect(200);

      expect(response.text).not.toMatch(/[0-9a-f]{24}/);
    });
  });
});
