import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Resolver('Tenant')
export class TenantResolver {
  constructor(private readonly tenantService: TenantService) {}

  @Mutation('createTenant')
  async createTenant(
    @Args('input') createTenantDto: CreateTenantDto,
    @Args('userId') userId: string,
  ) {
    return this.tenantService.create(createTenantDto, userId);
  }

  @Query('tenants')
  async tenants() {
    return this.tenantService.findAll();
  }

  @Query('tenant')
  async tenant(@Args('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Mutation('updateTenant')
  async updateTenant(
    @Args('id') id: string,
    @Args('input') updateTenantDto: UpdateTenantDto,
  ) {
    return this.tenantService.update(id, updateTenantDto);
  }

  @Mutation('deleteTenant')
  async deleteTenant(@Args('id') id: string) {
    return this.tenantService.remove(id);
  }
}
