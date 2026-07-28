import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import {
  createTestApp,
  TestApp,
  TEST_JWT_SECRET,
} from './helpers/create-test-app';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let context: TestApp;

  const credentials = { username: 'magnus', password: 'correct-password' };

  beforeAll(async () => {
    context = await createTestApp();
    app = context.app;
  });

  afterAll(async () => {
    await context?.close();
  });

  const signUp = (body: Record<string, unknown> = credentials) =>
    request(app.getHttpServer()).post('/auth/signup').send(body);

  const signIn = (body: Record<string, unknown> = credentials) =>
    request(app.getHttpServer()).post('/auth/signin').send(body);

  const me = (token?: string) => {
    const call = request(app.getHttpServer()).get('/users/me');

    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  const tokenFor = async () => (await signIn()).body.data.accessToken as string;

  const jwt = () => app.get(JwtService);

  describe('POST /auth/signup', () => {
    it('creates the user and returns a token inside the response envelope', async () => {
      const response = await signUp().expect(201);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 201,
        path: '/auth/signup',
        message: 'User created',
      });
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(response.body.requestId).toEqual(expect.any(String));
      expect(response.body.timestamp).toEqual(expect.any(String));
    });

    it('rejects a duplicated username through the unique index', async () => {
      const response = await signUp().expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(409);
      expect(response.body.requestId).toEqual(expect.any(String));
    });

    it('rejects a username that differs only by case', async () => {
      await signUp({ ...credentials, username: 'MAGNUS' }).expect(409);
    });

    it('rejects an unknown field in the payload', async () => {
      await signUp({ ...credentials, role: 'admin' }).expect(400);
    });

    it('reports every validation failure in the errors array', async () => {
      const response = await signUp({ username: 'a', password: 'x' }).expect(
        400,
      );

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors.length).toBeGreaterThan(1);
    });

    it.each([
      ['a username below the minimum length', { username: 'a' }],
      ['a username above the maximum length', { username: 'a'.repeat(33) }],
      ['a username starting with a dot', { username: '.magnus' }],
      ['a username ending with a dot', { username: 'magnus.' }],
      ['a username starting with an underscore', { username: '_magnus' }],
      ['a username ending with an underscore', { username: 'magnus_' }],
      ['a username with consecutive dots', { username: 'mag..nus' }],
      ['a username with a space', { username: 'magnus carlsen' }],
      ['a username with a non-ascii character', { username: 'magnÜs' }],
      ['a password below the minimum length', { password: 'short' }],
      ['a password above the maximum length', { password: 'a'.repeat(129) }],
    ])('rejects %s', async (_case, override) => {
      await signUp({ ...credentials, ...override }).expect(400);
    });

    it.each([
      ['an empty body', {}],
      ['a missing password', { username: 'someone' }],
      ['a missing username', { password: 'valid-password' }],
      ['a numeric username', { username: 42, password: 'valid-password' }],
      ['a null password', { username: 'someone', password: null }],
    ])('rejects %s', async (_case, body) => {
      await signUp(body as Record<string, unknown>).expect(400);
    });
  });

  describe('POST /auth/signin', () => {
    it('returns a token for the correct password', async () => {
      const response = await signIn().expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User signed in');
      expect(response.body.data.accessToken).toEqual(expect.any(String));
    });

    it('rejects a wrong password', async () => {
      const response = await signIn({
        username: credentials.username,
        password: 'wrong-password',
      }).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeUndefined();
    });

    it('rejects an unknown user with the same message as a wrong password', async () => {
      const unknownUser = await signIn({
        username: 'ghost',
        password: credentials.password,
      }).expect(401);
      const wrongPassword = await signIn({
        username: credentials.username,
        password: 'wrong-password',
      }).expect(401);

      expect(unknownUser.body.message).toBe(wrongPassword.body.message);
    });

    it('matches the username case insensitively', async () => {
      await signIn({ ...credentials, username: 'MAGNUS' }).expect(200);
    });
  });

  describe('issued access token', () => {
    it('carries the user id as subject', async () => {
      const payload = jwt().verify(await tokenFor(), {
        secret: TEST_JWT_SECRET,
      });

      expect(payload.sub).toMatch(/^[0-9a-f]{24}$/);
    });

    it('is typed as an access token', async () => {
      const payload = jwt().verify(await tokenFor(), {
        secret: TEST_JWT_SECRET,
      });

      expect(payload.type).toBe('access');
    });

    it('does not carry the password hash', async () => {
      const payload = jwt().verify(await tokenFor(), {
        secret: TEST_JWT_SECRET,
      });

      expect(payload).not.toHaveProperty('password');
    });
  });

  describe('GET /users/me', () => {
    it('returns the account behind the token', async () => {
      const response = await me(await tokenFor()).expect(200);

      expect(response.body.message).toBe('Current user');
      expect(response.body.data).toMatchObject({
        username: credentials.username,
      });
      expect(response.body.data.id).toMatch(/^[0-9a-f]{24}$/);
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('rejects a request without a token', async () => {
      const response = await me().expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.requestId).toEqual(expect.any(String));
    });

    it('rejects a malformed token', async () => {
      await me('not-a-jwt').expect(401);
    });

    it('rejects a token signed with another secret', async () => {
      const forged = jwt().sign(
        { sub: '507f1f77bcf86cd799439011', username: 'magnus', type: 'access' },
        { secret: 'a-completely-different-secret-value-here' },
      );

      await me(forged).expect(401);
    });

    it('rejects an expired token', async () => {
      const expired = jwt().sign(
        { sub: '507f1f77bcf86cd799439011', username: 'magnus', type: 'access' },
        { secret: TEST_JWT_SECRET, expiresIn: '-1s' },
      );

      await me(expired).expect(401);
    });

    it('rejects a refresh token presented as an access token', async () => {
      const refresh = jwt().sign(
        {
          sub: '507f1f77bcf86cd799439011',
          username: 'magnus',
          type: 'refresh',
        },
        { secret: TEST_JWT_SECRET },
      );

      await me(refresh).expect(401);
    });
  });

  describe('response bodies', () => {
    it('never leak the password on any route', async () => {
      const token = await tokenFor();
      const bodies = [
        (await signUp({ username: 'hikaru', password: 'another-password' }))
          .text,
        (await signIn()).text,
        (await signIn({ ...credentials, password: 'wrong-password' })).text,
        (await me(token)).text,
      ];

      for (const body of bodies) {
        expect(body).not.toContain('$2b$');
        expect(body).not.toContain('another-password');
      }
    });

    it('wraps every response in the same envelope shape', async () => {
      const responses = [
        await signIn(),
        await signIn({ ...credentials, password: 'wrong-password' }),
        await me(await tokenFor()),
        await me(),
      ];

      for (const response of responses) {
        expect(response.body).toMatchObject({
          success: expect.any(Boolean),
          statusCode: expect.any(Number),
          timestamp: expect.any(String),
          path: expect.any(String),
          message: expect.any(String),
          requestId: expect.any(String),
        });
      }
    });
  });
});
