import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
} from '@nestjs/swagger';
import { MatchService } from './match.service';
import { ConfirmMatchDto } from './dto/confirm-match.dto';
import { RejectMatchDto } from './dto/reject-match.dto';
import { FilterMatchDto } from './dto/filter-match.dto';
import { MatchResponseDto } from './dto/match-response.dto';

@ApiTags('matches')
@ApiBearerAuth()
@Controller('tenants/:tenant_id/matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Get()
  @ApiOperation({ summary: 'Get all matches for a tenant' })
  @ApiResponse({
    status: 200,
    description: 'List of matches',
    type: [MatchResponseDto],
  })
  async findAll(
    @Param('tenant_id') tenantId: string,
    @Query() filters: FilterMatchDto,
  ) {
    return this.matchService.findAll(tenantId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific match by ID' })
  @ApiResponse({
    status: 200,
    description: 'Match found',
    type: MatchResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Match not found' })
  async findOne(@Param('tenant_id') tenantId: string, @Param('id') id: string) {
    return this.matchService.findOne(tenantId, id);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a match',
    description:
      'Finalizes a proposed match and updates the invoice status to "matched"',
  })
  @ApiResponse({
    status: 200,
    description: 'Match confirmed successfully',
    type: MatchResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Match not found' })
  @ApiResponse({ status: 409, description: 'Match already confirmed' })
  async confirm(
    @Param('tenant_id') tenantId: string,
    @Param('id') matchId: string,
    @Body() confirmDto: ConfirmMatchDto,
  ) {
    return this.matchService.confirm(tenantId, matchId, confirmDto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a match' })
  @ApiResponse({
    status: 200,
    description: 'Match rejected successfully',
    type: MatchResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Match not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot reject confirmed match',
  })
  async reject(
    @Param('tenant_id') tenantId: string,
    @Param('id') matchId: string,
    @Body() rejectDto: RejectMatchDto,
  ) {
    return this.matchService.reject(tenantId, matchId, rejectDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a match' })
  @ApiResponse({ status: 204, description: 'Match deleted successfully' })
  @ApiResponse({ status: 404, description: 'Match not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete confirmed match',
  })
  async remove(
    @Param('tenant_id') tenantId: string,
    @Param('id') matchId: string,
  ) {
    return this.matchService.remove(tenantId, matchId);
  }

  @Get('invoice/:invoice_id')
  @ApiOperation({ summary: 'Get all matches for a specific invoice' })
  @ApiResponse({
    status: 200,
    description: 'List of matches for the invoice',
    type: [MatchResponseDto],
  })
  async getMatchesForInvoice(
    @Param('tenant_id') tenantId: string,
    @Param('invoice_id') invoiceId: string,
  ) {
    return this.matchService.getMatchesForInvoice(tenantId, invoiceId);
  }

  @Get('transaction/:transaction_id')
  @ApiOperation({ summary: 'Get all matches for a specific transaction' })
  @ApiResponse({
    status: 200,
    description: 'List of matches for the transaction',
    type: [MatchResponseDto],
  })
  async getMatchesForTransaction(
    @Param('tenant_id') tenantId: string,
    @Param('transaction_id') transactionId: string,
  ) {
    return this.matchService.getMatchesForTransaction(tenantId, transactionId);
  }
}
