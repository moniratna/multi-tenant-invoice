import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Reconciliation & Match Management (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let tenantId: string;
  let invoiceId: string;
  let transactionId: string;
  let matchId: string;

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
      .send({ email: 'reconcile@test.com', password: 'password123' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'reconcile@test.com', password: 'password123' });

    authToken = loginRes.body.access_token;

    const tenantRes = await request(app.getHttpServer())
      .post('/tenants')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Reconciliation Test Tenant' });

    tenantId = tenantRes.body.id;

    // Create test invoice
    const invoiceRes = await request(app.getHttpServer())
      .post(`/tenants/${tenantId}/invoices`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 1000.0,
        currency: 'USD',
        invoiceNumber: 'INV-TEST-001',
        description: 'Test invoice for reconciliation',
        status: 'open',
        invoiceDate: '2024-01-15T00:00:00Z',
      });

    invoiceId = invoiceRes.body.id;

    // Create test transaction
    const txnRes = await request(app.getHttpServer())
      .post(`/tenants/${tenantId}/bank-transactions/import`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        transactions: [
          {
            externalId: 'TXN-RECONCILE-001',
            postedAt: '2024-01-15T10:00:00Z',
            amount: 1000.0,
            currency: 'USD',
            description: 'Payment for INV-TEST-001',
          },
        ],
      });

    // Get transaction ID
    const txnsRes = await request(app.getHttpServer())
      .get(`/tenants/${tenantId}/bank-transactions`)
      .set('Authorization', `Bearer ${authToken}`);

    transactionId = txnsRes.body[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /tenants/:tenant_id/reconcile', () => {
    it('should run reconciliation and create match candidates', async () => {
      const response = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/reconcile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          topN: 5,
        })
        .expect(200);

      expect(response.body).toHaveProperty('matches');
      expect(response.body).toHaveProperty('totalCandidates');
      expect(response.body).toHaveProperty('invoicesProcessed');
      expect(response.body).toHaveProperty('transactionsProcessed');
      expect(response.body).toHaveProperty('processingTimeMs');

      expect(response.body.matches.length).toBeGreaterThan(0);
      expect(response.body.invoicesProcessed).toBe(1);
      expect(response.body.transactionsProcessed).toBe(1);

      // Store match ID for later tests
      matchId = response.body.matches[0].id;

      // Verify match properties
      const match = response.body.matches[0];
      expect(match).toHaveProperty('score');
      expect(match).toHaveProperty('explanation');
      expect(match.status).toBe('proposed');
      expect(match.invoiceId).toBe(invoiceId);
      expect(match.bankTransactionId).toBe(transactionId);
    });

    it('should handle reconciliation with specific invoice IDs', async () => {
      const response = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/reconcile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          topN: 3,
          invoiceIds: [invoiceId],
        })
        .expect(200);

      expect(response.body.invoicesProcessed).toBe(1);
    });

    it('should return empty result when no open invoices', async () => {
      // Create a new tenant with no invoices
      const newTenantRes = await request(app.getHttpServer())
        .post('/tenants')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Empty Tenant' });

      const response = await request(app.getHttpServer())
        .post(`/tenants/${newTenantRes.body.id}/reconcile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body.matches).toHaveLength(0);
      expect(response.body.invoicesProcessed).toBe(0);
    });
  });

  describe('GET /tenants/:tenant_id/reconcile/explain', () => {
    it('should explain a match between invoice and transaction', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/reconcile/explain`)
        .query({
          invoice_id: invoiceId,
          transaction_id: transactionId,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('score');
      expect(typeof response.body.explanation).toBe('string');
      expect(typeof response.body.score).toBe('number');
    });

    it('should return 400 for invalid invoice ID', async () => {
      await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/reconcile/explain`)
        .query({
          invoice_id: '00000000-0000-0000-0000-000000000000',
          transaction_id: transactionId,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /tenants/:tenant_id/matches', () => {
    it('should list all matches', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/matches`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter matches by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/matches`)
        .query({ status: 'proposed' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((match: any) => {
        expect(match.status).toBe('proposed');
      });
    });

    it('should filter matches by invoice ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/matches`)
        .query({ invoiceId })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((match: any) => {
        expect(match.invoiceId).toBe(invoiceId);
      });
    });
  });

  describe('GET /tenants/:tenant_id/matches/:id', () => {
    it('should get a specific match', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/matches/${matchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(matchId);
      expect(response.body).toHaveProperty('invoiceId');
      expect(response.body).toHaveProperty('bankTransactionId');
    });

    it('should return 404 for non-existent match', async () => {
      await request(app.getHttpServer())
        .get(
          `/tenants/${tenantId}/matches/00000000-0000-0000-0000-000000000000`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /tenants/:tenant_id/matches/:id/confirm', () => {
    it('should confirm a match', async () => {
      const response = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/matches/${matchId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          confirmedBy: 'test-user',
        })
        .expect(200);

      expect(response.body.status).toBe('confirmed');
      expect(response.body.confirmedBy).toBe('test-user');
      expect(response.body.confirmedAt).toBeDefined();

      // Verify invoice status changed to 'matched'
      const invoiceRes = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invoiceRes.body.status).toBe('matched');
    });

    it('should return 409 when confirming already confirmed match', async () => {
      await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/matches/${matchId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(409);
    });
  });

  describe('POST /tenants/:tenant_id/matches/:id/reject', () => {
    let rejectMatchId: string;

    beforeAll(async () => {
      // Create a new match to reject
      const reconcileRes = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/reconcile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ topN: 1 });

      const matches = reconcileRes.body.matches;
      rejectMatchId = matches.find((m: any) => m.status === 'proposed')?.id;
    });

    it('should reject a match', async () => {
      if (!rejectMatchId) {
        console.warn('No proposed match available to reject');
        return;
      }

      const response = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/matches/${rejectMatchId}/reject`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Incorrect match',
        })
        .expect(200);

      expect(response.body.status).toBe('rejected');
    });
  });

  describe('DELETE /tenants/:tenant_id/matches/:id', () => {
    it('should return 409 when deleting confirmed match', async () => {
      await request(app.getHttpServer())
        .delete(`/tenants/${tenantId}/matches/${matchId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);
    });
  });

  describe('GET /tenants/:tenant_id/matches/invoice/:invoice_id', () => {
    it('should get matches for specific invoice', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/matches/invoice/${invoiceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((match: any) => {
        expect(match.invoiceId).toBe(invoiceId);
      });
    });
  });

  describe('GET /tenants/:tenant_id/matches/transaction/:transaction_id', () => {
    it('should get matches for specific transaction', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/matches/transaction/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((match: any) => {
        expect(match.bankTransactionId).toBe(transactionId);
      });
    });
  });
});
