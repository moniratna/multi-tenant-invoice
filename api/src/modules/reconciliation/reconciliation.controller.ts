import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationRequestDto } from './dto/reconciliation-request.dto';
import { ReconciliationResponseDto } from './dto/reconciliation-response.dto';

@ApiTags('reconciliation')
@ApiBearerAuth()
@Controller('tenants/:tenant_id')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run reconciliation process',
    description:
      'Matches open invoices with bank transactions using deterministic scoring algorithm',
  })
  @ApiResponse({
    status: 200,
    description: 'Reconciliation completed successfully',
    type: ReconciliationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Python backend unavailable',
  })
  async reconcile(
    @Param('tenant_id') tenantId: string,
    @Body() requestDto: ReconciliationRequestDto,
  ) {
    return this.reconciliationService.reconcile(tenantId, requestDto);
  }

  @Get('reconcile/explain')
  @ApiOperation({
    summary: 'Explain a potential match between invoice and transaction',
    description:
      'Returns scoring details and explanation for why an invoice matches (or does not match) a transaction',
  })
  @ApiQuery({ name: 'invoice_id', required: true })
  @ApiQuery({ name: 'transaction_id', required: true })
  @ApiResponse({
    status: 200,
    description: 'Explanation generated successfully',
  })
  async explainMatch(
    @Param('tenant_id') tenantId: string,
    @Query('invoice_id') invoiceId: string,
    @Query('transaction_id') transactionId: string,
  ) {
    return this.reconciliationService.explainMatch(
      tenantId,
      invoiceId,
      transactionId,
    );
  }
}
