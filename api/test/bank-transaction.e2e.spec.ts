import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Bank Transaction Import with Idempotency (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // Setup
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'bank@test.com', password: 'password123' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'bank@test.com', password: 'password123' });

    authToken = loginRes.body.access_token;

    const tenantRes = await request(app.getHttpServer())
      .post('/tenants')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Bank Test Tenant' });

    tenantId = tenantRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /tenants/:tenant_id/bank-transactions/import', () => {
    const importPayload = {
      transactions: [
        {
          externalId: 'TXN-001',
          postedAt: '2024-01-15T10:00:00Z',
          amount: 1500.5,
          currency: 'USD',
          description: 'Payment from customer',
        },
        {
          externalId: 'TXN-002',
          postedAt: '2024-01-16T10:00:00Z',
          amount: 2000.0,
          currency: 'USD',
          description: 'Another payment',
        },
      ],
    };

    it('should import transactions successfully', async () => {
      const response = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/bank-transactions/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(importPayload)
        .expect(200);

      expect(response.body.imported).toBe(2);
      expect(response.body.duplicates).toBe(0);
      expect(response.body.errors).toBe(0);
    });

    it('should detect duplicates by externalId', async () => {
      // Import again - should skip duplicates
      const response = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/bank-transactions/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(importPayload)
        .expect(200);

      expect(response.body.imported).toBe(0);
      expect(response.body.duplicates).toBe(2);
    });

    it('should support idempotency with same key and payload', async () => {
      const idempotencyKey = 'test-key-123';

      // First request
      const response1 = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/bank-transactions/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          transactions: [
            {
              externalId: 'TXN-IDEMPOTENT-001',
              postedAt: '2024-01-17T10:00:00Z',
              amount: 500.0,
              currency: 'USD',
              description: 'Idempotent test',
            },
          ],
        })
        .expect(200);

      expect(response1.body.imported).toBe(1);

      // Second request with same key and payload - should return cached
      const response2 = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/bank-transactions/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          transactions: [
            {
              externalId: 'TXN-IDEMPOTENT-001',
              postedAt: '2024-01-17T10:00:00Z',
              amount: 500.0,
              currency: 'USD',
              description: 'Idempotent test',
            },
          ],
        })
        .expect(200);

      // Should return same result without importing again
      expect(response2.body.imported).toBe(1);
    });

    it('should reject same key with different payload', async () => {
      const idempotencyKey = 'test-key-conflict';

      // First request
      await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/bank-transactions/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          transactions: [
            {
              externalId: 'TXN-CONFLICT-001',
              postedAt: '2024-01-18T10:00:00Z',
              amount: 100.0,
              currency: 'USD',
            },
          ],
        })
        .expect(200);

      // Second request with same key but different payload
      await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/bank-transactions/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          transactions: [
            {
              externalId: 'TXN-CONFLICT-002',
              postedAt: '2024-01-19T10:00:00Z',
              amount: 200.0,
              currency: 'USD',
            },
          ],
        })
        .expect(409);
    });
  });

  describe('GET /tenants/:tenant_id/bank-transactions', () => {
    it('should list all bank transactions', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/bank-transactions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});
