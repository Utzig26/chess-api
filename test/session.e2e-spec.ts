import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import {
  createTestApp,
  TestApp,
  TEST_REFRESH_SECRET,
} from './helpers/create-test-app';

const REFRESH_COOKIE = 'refresh_token';

describe('Session lifecycle (e2e)', () => {
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

  beforeEach(async () => {
    await context.reset();
  });

  const server = () => app.getHttpServer();

  const cookiesOf = (response: request.Response): string[] =>
    (response.headers['set-cookie'] as unknown as string[]) ?? [];

  const refreshCookieOf = (response: request.Response): string => {
    const cookie = cookiesOf(response).find((value) =>
      value.startsWith(`${REFRESH_COOKIE}=`),
    );

    if (!cookie) throw new Error('no refresh cookie was set');

    return cookie.split(';')[0];
  };

  const signUp = () =>
    request(server()).post('/auth/signup').send(credentials).expect(201);

  const refreshWith = (cookie: string) =>
    request(server()).post('/auth/refresh').set('Cookie', cookie);

  const signOutWith = (cookie: string) =>
    request(server()).post('/auth/signout').set('Cookie', cookie);

  describe('the refresh cookie', () => {
    it('is set on sign up with the attributes that keep it out of scripts', async () => {
      const response = await signUp();

      const cookie = cookiesOf(response).find((value) =>
        value.startsWith(`${REFRESH_COOKIE}=`),
      ) as string;

      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/auth');
      expect(cookie).toContain('Expires=');
    });

    it('is not marked secure outside production', async () => {
      expect(refreshCookieOf(await signUp())).not.toContain('Secure');
    });

    it('never appears in the response body', async () => {
      const response = await signUp();

      expect(response.text).not.toContain(REFRESH_COOKIE);
      expect(Object.keys(response.body.data)).toEqual(['accessToken']);
    });

    it('is set again on sign in', async () => {
      await signUp();

      const response = await request(server())
        .post('/auth/signin')
        .send(credentials)
        .expect(200);

      expect(refreshCookieOf(response)).toBeTruthy();
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a new access token and a new refresh cookie', async () => {
      const first = refreshCookieOf(await signUp());

      const response = await refreshWith(first).expect(200);

      expect(response.body.message).toBe('Session refreshed');
      expect(response.body.data.accessToken).toEqual(expect.any(String));
      expect(refreshCookieOf(response)).not.toBe(first);
    });

    it('gives access to a protected route with the refreshed token', async () => {
      const cookie = refreshCookieOf(await signUp());

      const refreshed = await refreshWith(cookie).expect(200);

      await request(server())
        .get('/users/me')
        .set('Authorization', `Bearer ${refreshed.body.data.accessToken}`)
        .expect(200);
    });

    it('invalidates the token it rotated away from', async () => {
      const first = refreshCookieOf(await signUp());

      await refreshWith(first).expect(200);

      await refreshWith(first).expect(401);
    });

    it('revokes the whole family when a used token is replayed', async () => {
      const first = refreshCookieOf(await signUp());
      const second = refreshCookieOf(await refreshWith(first).expect(200));

      await refreshWith(first).expect(401);

      await refreshWith(second).expect(401);
    });

    it('rejects a request without the cookie', async () => {
      await request(server()).post('/auth/refresh').expect(401);
    });

    it('rejects a cookie that is not a token', async () => {
      await refreshWith(`${REFRESH_COOKIE}=not-a-jwt`).expect(401);
    });

    it('rejects a refresh token signed with another secret', async () => {
      const forged = app.get(JwtService).sign(
        {
          sub: '507f1f77bcf86cd799439011',
          username: 'magnus',
          type: 'refresh',
          family: 'forged',
        },
        { secret: 'yet-another-secret-that-is-long-enough!!' },
      );

      await refreshWith(`${REFRESH_COOKIE}=${forged}`).expect(401);
    });

    it('rejects a well signed token that the store never saw', async () => {
      const orphan = app.get(JwtService).sign(
        {
          sub: '507f1f77bcf86cd799439011',
          username: 'magnus',
          type: 'refresh',
          family: 'orphan',
        },
        { secret: TEST_REFRESH_SECRET },
      );

      await refreshWith(`${REFRESH_COOKIE}=${orphan}`).expect(401);
    });

    it('rejects an access token presented in the refresh cookie', async () => {
      const accessToken = (await signUp()).body.data.accessToken;

      await refreshWith(`${REFRESH_COOKIE}=${accessToken}`).expect(401);
    });
  });

  describe('POST /auth/signout', () => {
    it('clears the cookie and revokes the session', async () => {
      const cookie = refreshCookieOf(await signUp());

      const response = await signOutWith(cookie).expect(200);

      expect(response.body.message).toBe('User signed out');
      expect(
        cookiesOf(response).some(
          (value) =>
            value.startsWith(`${REFRESH_COOKIE}=;`) ||
            value.startsWith(`${REFRESH_COOKIE}=Thu`),
        ),
      ).toBe(true);

      await refreshWith(cookie).expect(401);
    });

    it('rejects a sign out without the cookie', async () => {
      await request(server()).post('/auth/signout').expect(401);
    });
  });

  describe('POST /auth/signout-all', () => {
    it('revokes every open session of the account', async () => {
      const firstDevice = refreshCookieOf(await signUp());
      const secondDevice = refreshCookieOf(
        await request(server())
          .post('/auth/signin')
          .send(credentials)
          .expect(200),
      );
      const accessToken = (
        await request(server())
          .post('/auth/signin')
          .send(credentials)
          .expect(200)
      ).body.data.accessToken;

      await request(server())
        .post('/auth/signout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await refreshWith(firstDevice).expect(401);
      await refreshWith(secondDevice).expect(401);
    });

    it('requires an access token', async () => {
      await request(server()).post('/auth/signout-all').expect(401);
    });
  });

  describe('sessions are independent', () => {
    it('does not touch another session when one is signed out', async () => {
      const firstDevice = refreshCookieOf(await signUp());
      const secondDevice = refreshCookieOf(
        await request(server())
          .post('/auth/signin')
          .send(credentials)
          .expect(200),
      );

      await signOutWith(firstDevice).expect(200);

      await refreshWith(secondDevice).expect(200);
    });
  });
});
