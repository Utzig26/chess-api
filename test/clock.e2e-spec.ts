import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';
import { createTestApp, TestApp } from './helpers/create-test-app';
import { Game, GameDocument } from '../src/games/schema/game.schema';

describe('Clock (e2e)', () => {
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

  const play = (token: string, id: string, move: string) =>
    request(server())
      .post(`/games/${id}/move`)
      .set('Authorization', `Bearer ${token}`)
      .send({ move });

  const readMoves = (id: string) => request(server()).get(`/games/${id}/moves`);

  const openTable = async (control = timeControl) => {
    const white = await tokenFor('magnus');
    const black = await tokenFor('hikaru');

    const { body } = await request(server())
      .post('/games')
      .set('Authorization', `Bearer ${white}`)
      .send({ pieces: 'w', timeControl: control })
      .expect(201);

    await request(server())
      .post(`/games/${body.data.id}/join`)
      .set('Authorization', `Bearer ${black}`)
      .expect(200);

    return { id: body.data.id as string, white, black };
  };

  const rewind = async (id: string, seconds: number) => {
    const game = await games.findOne({ resourceId: id }).exec();
    if (!game) throw new Error('game vanished');

    const shift = seconds * 1000;
    game.startedAt = new Date(game.startedAt!.getTime() - shift);
    game.history.forEach((move) => {
      move.timestamp = new Date(move.timestamp.getTime() - shift);
    });

    await game.save();
  };

  describe('before the first move', () => {
    it('does not run the clock while the game waits', async () => {
      const table = await openTable();
      await rewind(table.id, 120);

      const { body } = await readMoves(table.id).expect(200);

      expect(body.data.game.timeControl).toEqual(timeControl);
    });
  });

  describe('after a move', () => {
    it('charges the mover and adds the increment', async () => {
      const table = await openTable();
      await rewind(table.id, 20);

      const { body } = await play(table.white, table.id, 'e4').expect(200);

      expect(body.data.timeControl.white).toBeLessThan(600);
      expect(body.data.timeControl.white).toBeGreaterThan(580);
      expect(body.data.timeControl.black).toBe(600);
    });

    it('counts down for the side that now has to move', async () => {
      const table = await openTable();
      await play(table.white, table.id, 'e4').expect(200);
      await rewind(table.id, 30);

      const { body } = await readMoves(table.id).expect(200);

      expect(body.data.game.timeControl.black).toBeLessThan(575);
      expect(body.data.game.timeControl.black).toBeGreaterThan(565);
    });
  });

  describe('reading never writes', () => {
    it('leaves updatedAt alone across repeated reads', async () => {
      const table = await openTable();
      await play(table.white, table.id, 'e4').expect(200);

      const before = (await games.findOne({ resourceId: table.id }).exec())!;
      const stamp = before.get('updatedAt').getTime();

      await readMoves(table.id).expect(200);
      await readMoves(table.id).expect(200);
      await readMoves(table.id).expect(200);

      const after = (await games.findOne({ resourceId: table.id }).exec())!;
      expect(after.get('updatedAt').getTime()).toBe(stamp);
    });

    it('shows a different remaining time on each read of the same document', async () => {
      const table = await openTable();
      await play(table.white, table.id, 'e4').expect(200);

      const first = await readMoves(table.id).expect(200);
      await rewind(table.id, 40);
      const second = await readMoves(table.id).expect(200);

      expect(second.body.data.game.timeControl.black).toBeLessThan(
        first.body.data.game.timeControl.black,
      );
    });
  });

  describe('running out of time', () => {
    it('reports the game as finished on a read, without persisting it', async () => {
      const table = await openTable({ white: 600, black: 10, increment: 0 });
      await play(table.white, table.id, 'e4').expect(200);
      await rewind(table.id, 30);

      const { body } = await readMoves(table.id).expect(200);

      expect(body.data.game.status).toMatchObject({
        state: 'F',
        result: 'White wins',
        additionalInfo: 'Win on time',
      });
      expect(body.data.game.timeControl.black).toBe(0);

      const stored = (await games.findOne({ resourceId: table.id }).exec())!;
      expect(stored.status.state).toBe('A');
    });

    it('persists the loss when a move is attempted after the flag fell', async () => {
      const table = await openTable({ white: 600, black: 10, increment: 0 });
      await play(table.white, table.id, 'e4').expect(200);
      await rewind(table.id, 30);

      const response = await play(table.black, table.id, 'e5').expect(409);
      expect(response.body.message).toBe('Time is up');

      const stored = (await games.findOne({ resourceId: table.id }).exec())!;
      expect(stored.status.state).toBe('F');
      expect(stored.status.result).toBe('White wins');
      expect(stored.timeControl.black).toBe(0);
    });

    it('refuses any further move once the loss is persisted', async () => {
      const table = await openTable({ white: 600, black: 10, increment: 0 });
      await play(table.white, table.id, 'e4').expect(200);
      await rewind(table.id, 30);
      await play(table.black, table.id, 'e5').expect(409);

      const response = await play(table.black, table.id, 'e5').expect(409);
      expect(response.body.message).toBe('This game is not accepting moves');
    });
  });
});
