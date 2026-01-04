import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AI Explanation Service (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let tenantId: string;
  let invoiceId: string;
  let transactionId: string;

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
      .send({ email: 'ai@test.com', password: 'password123' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ai@test.com', password: 'password123' });

    authToken = loginRes.body.access_token;

    const tenantRes = await request(app.getHttpServer())
      .post('/tenants')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'AI Test Tenant' });

    tenantId = tenantRes.body.id;

    // Create test invoice
    const invoiceRes = await request(app.getHttpServer())
      .post(`/tenants/${tenantId}/invoices`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 2500.0,
        currency: 'USD',
        invoiceNumber: 'INV-AI-001',
        description: 'Professional services',
        status: 'open',
        invoiceDate: '2024-01-20T00:00:00Z',
      });

    invoiceId = invoiceRes.body.id;

    // Create test transaction
    await request(app.getHttpServer())
      .post(`/tenants/${tenantId}/bank-transactions/import`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        transactions: [
          {
            externalId: 'TXN-AI-001',
            postedAt: '2024-01-20T14:30:00Z',
            amount: 2500.0,
            currency: 'USD',
            description: 'Payment received for INV-AI-001',
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

  describe('GET /tenants/:tenant_id/ai-explanation', () => {
    it('should generate AI explanation for a match', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/ai-explanation`)
        .query({
          invoice_id: invoiceId,
          transaction_id: transactionId,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('score');
      expect(response.body).toHaveProperty('confidenceLabel');
      expect(response.body).toHaveProperty('source');
      expect(response.body).toHaveProperty('invoiceDetails');
      expect(response.body).toHaveProperty('transactionDetails');
      expect(response.body).toHaveProperty('processingTimeMs');

      // Verify data types
      expect(typeof response.body.explanation).toBe('string');
      expect(typeof response.body.score).toBe('number');
      expect(typeof response.body.confidenceLabel).toBe('string');
      expect(['ai', 'fallback']).toContain(response.body.source);

      // Verify score is in valid range
      expect(response.body.score).toBeGreaterThanOrEqual(0);
      expect(response.body.score).toBeLessThanOrEqual(100);

      // Verify confidence labels
      expect(['Very High', 'High', 'Medium', 'Low', 'Very Low']).toContain(
        response.body.confidenceLabel,
      );

      // Verify invoice details
      expect(response.body.invoiceDetails.amount).toBe('2500.00');
      expect(response.body.invoiceDetails.currency).toBe('USD');
      expect(response.body.invoiceDetails.invoiceNumber).toBe('INV-AI-001');

      // Verify transaction details
      expect(response.body.transactionDetails.amount).toBe('2500.00');
      expect(response.body.transactionDetails.currency).toBe('USD');

      console.log('AI Explanation:', response.body.explanation);
      console.log('Score:', response.body.score);
      console.log('Source:', response.body.source);
    });

    it('should use fallback when force_fallback is true', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/ai-explanation`)
        .query({
          invoice_id: invoiceId,
          transaction_id: transactionId,
          force_fallback: 'true',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.source).toBe('fallback');
      expect(response.body.explanation).toBeTruthy();
      expect(typeof response.body.explanation).toBe('string');
      expect(response.body.explanation.length).toBeGreaterThan(20);
    });

    it('should return high score for perfect match', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/ai-explanation`)
        .query({
          invoice_id: invoiceId,
          transaction_id: transactionId,
          force_fallback: 'true', // Use fallback for deterministic test
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Perfect match should have high score
      expect(response.body.score).toBeGreaterThan(70);
      expect(['Very High', 'High']).toContain(response.body.confidenceLabel);
    });

    it('should return 400 for invalid invoice ID', async () => {
      await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/ai-explanation`)
        .query({
          invoice_id: '00000000-0000-0000-0000-000000000000',
          transaction_id: transactionId,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return 400 for invalid transaction ID', async () => {
      await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/ai-explanation`)
        .query({
          invoice_id: invoiceId,
          transaction_id: '00000000-0000-0000-0000-000000000000',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('AI Explanation - Poor Match', () => {
    let poorMatchInvoiceId: string;
    let poorMatchTransactionId: string;

    beforeAll(async () => {
      // Create invoice and transaction that don't match well
      const invoiceRes = await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/invoices`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 1000.0,
          currency: 'USD',
          invoiceNumber: 'INV-POOR-001',
          description: 'Software license',
          status: 'open',
          invoiceDate: '2024-01-10T00:00:00Z',
        });

      poorMatchInvoiceId = invoiceRes.body.id;

      await request(app.getHttpServer())
        .post(`/tenants/${tenantId}/bank-transactions/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transactions: [
            {
              externalId: 'TXN-POOR-001',
              postedAt: '2024-02-15T10:00:00Z', // 36 days later
              amount: 5000.0, // Very different amount
              currency: 'USD',
              description: 'Office furniture purchase',
            },
          ],
        });

      const txnsRes = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/bank-transactions`)
        .set('Authorization', `Bearer ${authToken}`);

      poorMatchTransactionId = txnsRes.body.find(
        (t: any) => t.externalId === 'TXN-POOR-001',
      )?.id;
    });

    it('should return low score for poor match', async () => {
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/ai-explanation`)
        .query({
          invoice_id: poorMatchInvoiceId,
          transaction_id: poorMatchTransactionId,
          force_fallback: 'true',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Poor match should have low score
      expect(response.body.score).toBeLessThan(40);
      expect(['Low', 'Very Low']).toContain(response.body.confidenceLabel);

      console.log('Poor Match Explanation:', response.body.explanation);
      console.log('Poor Match Score:', response.body.score);
    });
  });

  describe('AI Provider Configuration', () => {
    it('should handle mock provider correctly', async () => {
      // Mock provider should always be available
      const response = await request(app.getHttpServer())
        .get(`/tenants/${tenantId}/ai-explanation`)
        .query({
          invoice_id: invoiceId,
          transaction_id: transactionId,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should return valid explanation regardless of provider
      expect(response.body.explanation).toBeTruthy();
      expect(response.body.score).toBeGreaterThanOrEqual(0);
      expect(response.body.score).toBeLessThanOrEqual(100);
    });
  });
});
