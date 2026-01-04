import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { tenants, users } from '../../database/schema';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createTenantDto: CreateTenantDto, userId: string) {
    try {
      const [tenant] = await this.databaseService.db
        .insert(tenants)
        .values({
          name: createTenantDto.name,
        })
        .returning();

      // Update user with tenantId
      await this.databaseService.db
        .update(users)
        .set({
          tenantId: tenant.id,
        })
        .where(eq(users.id, userId));

      return tenant;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      ) {
        // Unique constraint violation
        throw new ConflictException('Tenant with this name already exists');
      }
      throw error;
    }
  }

  async findAll() {
    return this.databaseService.db.select().from(tenants);
  }

  async findOne(id: string) {
    const [tenant] = await this.databaseService.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    // Verify tenant exists
    await this.findOne(id);

    const [updatedTenant] = await this.databaseService.db
      .update(tenants)
      .set({
        ...updateTenantDto,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();

    return updatedTenant;
  }

  async remove(id: string) {
    // Verify tenant exists
    await this.findOne(id);

    await this.databaseService.db.delete(tenants).where(eq(tenants.id, id));

    return { message: `Tenant ${id} deleted successfully` };
  }

  async exists(id: string): Promise<boolean> {
    const [tenant] = await this.databaseService.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    return !!tenant;
  }
}
