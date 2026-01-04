import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Invoice Management (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let tenantId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // Setup: Register, login, create tenant
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'invoice@test.com', password: 'password123' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'invoice@test.com', password: 'password123' });

    authToken = loginRes.body.access_token;

    const tenantRes = await request(app.getHttpServer())
      .post('/tenants')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Invoice Test Tenant' });

    tenantId = tenantRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /tenants/:tenant_id/invoices', () => {
    it('should create an invoice', async () => {
      const response = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 1500.5,
          currency: 'USD',
          invoiceNumber: 'INV-001',
          description: 'Test invoice',
          status: 'open',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe('1500.50');
      expect(response.body.currency).toBe('USD');
      invoiceId = response.body.id;
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /tenants/:tenant_id/invoices', () => {
    it('should list all invoices', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/invoices?status=open`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((inv: any) => {
        expect(inv.status).toBe('open');
      });
    });

    it('should filter by amount range', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/invoices?amountMin=1000&amountMax=2000`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/invoices?limit=5&offset=0`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /tenants/:tenant_id/invoices/:id', () => {
    it('should get a specific invoice', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(invoiceId);
    });

    it('should return 404 for non-existent invoice', async () => {
      await request(app.getHttpServer())
        .get(
          `/tenants/${tenantId}/invoices/00000000-0000-0000-0000-000000000000`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /tenants/:tenant_id/invoices/:id', () => {
    it('should update an invoice', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/tenants/${tenantId}/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'paid',
          description: 'Updated description',
        })
        .expect(200);

      expect(response.body.status).toBe('paid');
      expect(response.body.description).toBe('Updated description');
    });
  });

  describe('DELETE /tenants/:tenant_id/invoices/:id', () => {
    it('should delete an invoice', async () => {
      await request(app.getHttpServer())
        .delete(`/tenants/${tenantId}/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
