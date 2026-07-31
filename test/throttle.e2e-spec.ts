import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TestApp } from './helpers/create-test-app';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;
  let context: TestApp;

  const authLimit = 3;

  beforeAll(async () => {
    context = await createTestApp({ authThrottleLimit: authLimit });
    app = context.app;
  });

  afterAll(async () => {
    await context?.close();
  });

  const attemptSignIn = () =>
    request(app.getHttpServer())
      .post('/auth/signin')
      .send({ username: 'nobody', password: 'a-password-value' });

  it('lets the configured number of attempts through', async () => {
    for (let attempt = 0; attempt < authLimit; attempt++) {
      await attemptSignIn().expect(401);
    }
  });

  it('answers 429 once the limit is crossed', async () => {
    const response = await attemptSignIn().expect(429);

    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(429);
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  it('counts each auth route on its own budget', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ username: 'hikaru', password: 'a-password-value' })
      .expect(201);
  });

  it('does not throttle routes outside the auth controller', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });
});
