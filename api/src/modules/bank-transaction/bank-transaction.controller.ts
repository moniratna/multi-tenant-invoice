import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { BankTransactionService } from './bank-transaction.service';
import { CreateBankTransactionDto } from './dto/create-bank-transaction.dto';
import { ImportBankTransactionsDto } from './dto/import-bank-transactions.dto';
import { BankTransactionResponseDto } from './dto/bank-transaction-response.dto';
import { ImportResponseDto } from './dto/import-response.dto';

@ApiTags('bank-transactions')
@ApiBearerAuth()
@Controller('tenants/:tenant_id/bank-transactions')
export class BankTransactionController {
  constructor(
    private readonly bankTransactionService: BankTransactionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a single bank transaction' })
  @ApiResponse({
    status: 201,
    description: 'Bank transaction created successfully',
    type: BankTransactionResponseDto,
  })
  async create(
    @Param('tenant_id') tenantId: string,
    @Body() createDto: CreateBankTransactionDto,
  ) {
    return this.bankTransactionService.create(tenantId, createDto);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import bank transactions in bulk',
    description:
      'Supports idempotency via Idempotency-Key header. Same key with same payload returns cached result. Same key with different payload returns 409.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key for idempotent import (optional)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Import completed',
    type: ImportResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Idempotency key conflict - different payload',
  })
  async import(
    @Param('tenant_id') tenantId: string,
    @Body() importDto: ImportBankTransactionsDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.bankTransactionService.import(
      tenantId,
      importDto,
      idempotencyKey,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all bank transactions for a tenant' })
  @ApiResponse({
    status: 200,
    description: 'List of bank transactions',
    type: [BankTransactionResponseDto],
  })
  async findAll(@Param('tenant_id') tenantId: string) {
    return this.bankTransactionService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific bank transaction by ID' })
  @ApiResponse({
    status: 200,
    description: 'Bank transaction found',
    type: BankTransactionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Bank transaction not found' })
  async findOne(@Param('tenant_id') tenantId: string, @Param('id') id: string) {
    return this.bankTransactionService.findOne(tenantId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a bank transaction' })
  @ApiResponse({
    status: 204,
    description: 'Bank transaction deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Bank transaction not found' })
  async remove(@Param('tenant_id') tenantId: string, @Param('id') id: string) {
    return this.bankTransactionService.remove(tenantId, id);
  }
}
