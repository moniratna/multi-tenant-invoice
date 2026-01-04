import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

describe('Tenant Management (e2e)', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let authToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

    databaseService = moduleFixture.get<DatabaseService>(DatabaseService);

    await app.init();

    // Register a user and get auth token
    const registerResponse = await request
      .default(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    const loginResponse = await request
      .default(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /tenants', () => {
    it('should create a new tenant', async () => {
      const response = await request
        .default(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Tenant',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Tenant');
      tenantId = response.body.id;
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .send({
          name: 'Test Tenant 2',
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /tenants', () => {
    it('should return all tenants', async () => {
      const response = await request(app.getHttpServer())
        .get('/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /tenants/:id', () => {
    it('should return a specific tenant', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(tenantId);
      expect(response.body.name).toBe('Test Tenant');
    });

    it('should return 404 for non-existent tenant', async () => {
      await request(app.getHttpServer())
        .get('/tenants/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /tenants/:id', () => {
    it('should update a tenant', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Tenant Name',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Tenant Name');
    });
  });

  describe('DELETE /tenants/:id', () => {
    it('should delete a tenant', async () => {
      await request(app.getHttpServer())
        .delete(`/tenants/${tenantId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });
  });
});
