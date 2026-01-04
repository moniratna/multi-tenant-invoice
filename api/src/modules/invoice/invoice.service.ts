import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { invoices } from '../../database/schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { FilterInvoiceDto } from './dto/filter-invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(tenantId: string, createInvoiceDto: CreateInvoiceDto) {
    const [invoice] = await this.databaseService.db
      .insert(invoices)
      .values({
        tenantId,
        vendorId: createInvoiceDto.vendorId,
        invoiceNumber: createInvoiceDto.invoiceNumber,
        amount: createInvoiceDto.amount.toString(),
        currency: createInvoiceDto.currency || 'USD',
        invoiceDate: createInvoiceDto.invoiceDate
          ? new Date(createInvoiceDto.invoiceDate)
          : null,
        description: createInvoiceDto.description,
        status: createInvoiceDto.status || 'open',
      })
      .returning();

    return invoice;
  }

  async findAll(tenantId: string, filters?: FilterInvoiceDto) {
    // Build where conditions
    const conditions = [eq(invoices.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(invoices.status, filters.status));
    }

    if (filters?.vendorId) {
      conditions.push(eq(invoices.vendorId, filters.vendorId));
    }

    if (filters?.dateFrom) {
      conditions.push(gte(invoices.invoiceDate, new Date(filters.dateFrom)));
    }

    if (filters?.dateTo) {
      conditions.push(lte(invoices.invoiceDate, new Date(filters.dateTo)));
    }

    if (filters?.amountMin !== undefined) {
      conditions.push(
        sql`CAST(${invoices.amount} AS DECIMAL) >= ${filters.amountMin}`,
      );
    }

    if (filters?.amountMax !== undefined) {
      conditions.push(
        sql`CAST(${invoices.amount} AS DECIMAL) <= ${filters.amountMax}`,
      );
    }

    if (filters?.currency) {
      conditions.push(eq(invoices.currency, filters.currency));
    }

    // Execute query with filters
    const query = this.databaseService.db
      .select()
      .from(invoices)
      .where(and(...conditions));

    // Apply pagination
    if (filters?.limit) {
      query.limit(filters.limit);
    }

    if (filters?.offset) {
      query.offset(filters.offset);
    }

    return query;
  }

  async findOne(tenantId: string, id: string) {
    const [invoice] = await this.databaseService.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  async update(
    tenantId: string,
    id: string,
    updateInvoiceDto: UpdateInvoiceDto,
  ) {
    // Verify invoice exists and belongs to tenant
    await this.findOne(tenantId, id);

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updateInvoiceDto.vendorId !== undefined) {
      updateData.vendorId = updateInvoiceDto.vendorId;
    }

    if (updateInvoiceDto.invoiceNumber !== undefined) {
      updateData.invoiceNumber = updateInvoiceDto.invoiceNumber;
    }

    if (updateInvoiceDto.amount !== undefined) {
      updateData.amount = updateInvoiceDto.amount.toString();
    }

    if (updateInvoiceDto.currency !== undefined) {
      updateData.currency = updateInvoiceDto.currency;
    }

    if (updateInvoiceDto.invoiceDate !== undefined) {
      updateData.invoiceDate = updateInvoiceDto.invoiceDate
        ? new Date(updateInvoiceDto.invoiceDate)
        : null;
    }

    if (updateInvoiceDto.description !== undefined) {
      updateData.description = updateInvoiceDto.description;
    }

    if (updateInvoiceDto.status !== undefined) {
      updateData.status = updateInvoiceDto.status;
    }

    const [updatedInvoice] = await this.databaseService.db
      .update(invoices)
      .set(updateData)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning();

    return updatedInvoice;
  }

  async remove(tenantId: string, id: string) {
    // Verify invoice exists and belongs to tenant
    await this.findOne(tenantId, id);

    await this.databaseService.db
      .delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));

    return { message: `Invoice ${id} deleted successfully` };
  }

  async count(tenantId: string, filters?: FilterInvoiceDto): Promise<number> {
    const conditions = [eq(invoices.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(invoices.status, filters.status));
    }

    if (filters?.vendorId) {
      conditions.push(eq(invoices.vendorId, filters.vendorId));
    }

    const result = await this.databaseService.db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(and(...conditions));

    return Number(result[0]?.count || 0);
  }
}
