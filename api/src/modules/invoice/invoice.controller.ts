import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { FilterInvoiceDto } from './dto/filter-invoice.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('tenants/:tenant_id/invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new invoice for a tenant' })
  @ApiResponse({
    status: 201,
    description: 'Invoice created successfully',
    type: InvoiceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async create(
    @Param('tenant_id') tenantId: string,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ) {
    return this.invoiceService.create(tenantId, createInvoiceDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all invoices for a tenant with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invoices',
    type: [InvoiceResponseDto],
  })
  async findAll(
    @Param('tenant_id') tenantId: string,
    @Query() filters: FilterInvoiceDto,
  ) {
    return this.invoiceService.findAll(tenantId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific invoice by ID' })
  @ApiResponse({
    status: 200,
    description: 'Invoice found',
    type: InvoiceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findOne(@Param('tenant_id') tenantId: string, @Param('id') id: string) {
    return this.invoiceService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an invoice' })
  @ApiResponse({
    status: 200,
    description: 'Invoice updated successfully',
    type: InvoiceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async update(
    @Param('tenant_id') tenantId: string,
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoiceService.update(tenantId, id, updateInvoiceDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an invoice' })
  @ApiResponse({ status: 204, description: 'Invoice deleted successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async remove(@Param('tenant_id') tenantId: string, @Param('id') id: string) {
    return this.invoiceService.remove(tenantId, id);
  }
}
