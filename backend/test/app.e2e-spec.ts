import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { bodyOf } from './helpers/http-response.js';

interface OpenApiDocument {
  components: {
    securitySchemes: Record<
      string,
      { type: string; scheme: string; bearerFormat: string }
    >;
    schemas: Record<string, unknown>;
  };
  tags: Array<{ name: string }>;
  paths: Record<
    string,
    {
      post?: {
        security?: Array<Record<string, string[]>>;
        responses: Record<string, unknown>;
      };
    }
  >;
}

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

  it('GET /docs-json documents bearer auth, domains and common errors', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200)
      .expect('Content-Type', /json/);
    const document = bodyOf<OpenApiDocument>(response);

    expect(document.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(document.components.schemas).toHaveProperty('ApiError');
    expect(document.tags.map((tag) => tag.name)).toEqual(
      expect.arrayContaining([
        'seller-applications',
        'seller-products',
        'cart',
        'checkout',
        'seller-orders',
        'auction-bids',
        'reviews',
        'admin-disputes',
        'seller-dashboard',
        'admin-analytics',
      ]),
    );
    expect(document.paths['/checkout'].post?.security).toEqual([
      { bearer: [] },
    ]);
    expect(
      Object.keys(document.paths['/checkout'].post?.responses ?? {}),
    ).toEqual(expect.arrayContaining(['201', '400', '401', '403', '409']));
  });

  afterAll(async () => {
    await app.close();
  });
});
