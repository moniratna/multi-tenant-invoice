import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { invoices, tenants } from '../src/database/schema';

describe('RLS Enforcement (e2e)', () => {
  let app: INestApplication;
  let databaseService: DatabaseService;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    databaseService = moduleFixture.get<DatabaseService>(DatabaseService);

    await app.init();

    // Create two tenants
    const [tenantA] = await databaseService.db
      .insert(tenants)
      .values({ name: 'Tenant A' })
      .returning();

    const [tenantB] = await databaseService.db
      .insert(tenants)
      .values({ name: 'Tenant B' })
      .returning();

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    // Create invoices for both tenants
    await databaseService.db.insert(invoices).values([
      {
        tenantId: tenantAId,
        amount: '100.00',
        currency: 'USD',
        status: 'open',
      },
      {
        tenantId: tenantBId,
        amount: '200.00',
        currency: 'USD',
        status: 'open',
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should enforce tenant isolation at database level', async () => {
    // Set context to Tenant A
    await databaseService.setContext(undefined, tenantAId, false);

    // Query invoices - should only see Tenant A's invoices
    const tenantAInvoices = await databaseService.db.select().from(invoices);

    expect(tenantAInvoices).toHaveLength(1);
    expect(tenantAInvoices[0].tenantId).toBe(tenantAId);

    // Set context to Tenant B
    await databaseService.setContext(undefined, tenantBId, false);

    // Query invoices - should only see Tenant B's invoices
    const tenantBInvoices = await databaseService.db.select().from(invoices);

    expect(tenantBInvoices).toHaveLength(1);
    expect(tenantBInvoices[0].tenantId).toBe(tenantBId);
  });

  it('should allow super admin to see all invoices', async () => {
    // Set context as super admin
    await databaseService.setContext(undefined, undefined, true);

    // Query invoices - should see all invoices
    const allInvoices = await databaseService.db.select().from(invoices);

    expect(allInvoices.length).toBeGreaterThanOrEqual(2);
  });

  it('should block cross-tenant access', async () => {
    // Set context to Tenant A
    await databaseService.setContext(undefined, tenantAId, false);

    // Try to query all invoices - RLS should filter to only Tenant A
    const invoicesQuery = await databaseService.db.select().from(invoices);

    // Should NOT contain Tenant B's invoices
    const hasTenantBInvoice = invoicesQuery.some(
      (inv) => inv.tenantId === tenantBId,
    );

    expect(hasTenantBInvoice).toBe(false);
  });
});
