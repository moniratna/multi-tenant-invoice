import {
  Controller,
  Get,
  Query,
  Param,
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
import { AiExplanationService } from './ai-explanation.service';
import { AiExplanationResponseDto } from './dto/ai-explanation-response.dto';

@ApiTags('ai-explanation')
@ApiBearerAuth()
@Controller('tenants/:tenant_id')
export class AiExplanationController {
  constructor(private readonly aiExplanationService: AiExplanationService) {}

  @Get('ai-explanation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get AI-powered explanation for an invoice-transaction match',
    description:
      'Uses LLM (OpenAI/Anthropic) or fallback logic to explain why an invoice and transaction match or do not match. Gracefully degrades to deterministic explanation if AI is unavailable.',
  })
  @ApiQuery({ name: 'invoice_id', required: true, description: 'Invoice UUID' })
  @ApiQuery({
    name: 'transaction_id',
    required: true,
    description: 'Transaction UUID',
  })
  @ApiQuery({
    name: 'force_fallback',
    required: false,
    type: Boolean,
    description: 'Force use of fallback explanation (for testing)',
  })
  @ApiResponse({
    status: 200,
    description: 'Explanation generated successfully',
    type: AiExplanationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invoice or transaction not found',
  })
  async getExplanation(
    @Param('tenant_id') tenantId: string,
    @Query('invoice_id') invoiceId: string,
    @Query('transaction_id') transactionId: string,
    @Query('force_fallback') forceFallback?: string,
  ): Promise<AiExplanationResponseDto> {
    const useFallback = forceFallback === 'true';

    return this.aiExplanationService.generateExplanation(
      tenantId,
      invoiceId,
      transactionId,
      useFallback,
    );
  }
}
