import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { bodyOf } from './helpers/http-response.js';

describe('Backend foundation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('GET /health reports PostgreSQL as available', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(bodyOf(response)).toMatchObject({
      status: 'ok',
      info: {
        database: {
          status: 'up',
        },
      },
    });
  });

  it('GET /metrics exposes Prometheus metrics', async () => {
    const response = await request(app.getHttpServer())
      .get('/metrics')
      .expect(200)
      .expect('Content-Type', /text\/plain/);

    expect(response.text).toContain(
      '# HELP marketplace_process_cpu_user_seconds_total',
    );
  });

  it('GET /docs serves Swagger UI', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs')
      .expect(200);

    expect(response.text).toContain('Swagger UI');
  });

  afterAll(async () => {
    await app.close();
  });
});
