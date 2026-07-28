import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
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

  const decode = (token: string) =>
    app.get(JwtService).verify(token, { secret: TEST_JWT_SECRET });

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
      expect(response.body.timestamp).toEqual(expect.any(String));
    });

    it('rejects a duplicated username', async () => {
      const response = await signUp().expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(409);
    });

    it('rejects an unknown field in the payload', async () => {
      await signUp({ ...credentials, role: 'admin' }).expect(400);
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
      const response = await signIn().expect(200);

      const payload = decode(response.body.data.accessToken);

      expect(payload.sub).toBeDefined();
      expect(payload.sub).toMatch(/^[0-9a-f]{24}$/);
    });

    it('is typed as an access token', async () => {
      const response = await signIn().expect(200);

      expect(decode(response.body.data.accessToken).type).toBe('access');
    });

    it('does not carry the password hash', async () => {
      const response = await signIn().expect(200);

      expect(decode(response.body.data.accessToken)).not.toHaveProperty(
        'password',
      );
    });
  });

  describe('response bodies', () => {
    it('never leak the password on any auth route', async () => {
      const bodies = [
        (await signUp({ username: 'hikaru', password: 'another-password' }))
          .text,
        (await signIn()).text,
        (await signIn({ ...credentials, password: 'wrong-password' })).text,
      ];

      for (const body of bodies) {
        expect(body).not.toContain('password');
        expect(body).not.toContain('$2b$');
      }
    });
  });
});
