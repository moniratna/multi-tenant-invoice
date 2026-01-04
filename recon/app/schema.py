import strawberry
from typing import List, Optional
from datetime import datetime
from decimal import Decimal


@strawberry.type
class MatchCandidateType:
    """GraphQL type for match candidate"""
    invoice_id: str
    transaction_id: str
    score: float
    amount_score: float
    date_score: float
    text_score: float
    explanation: str


@strawberry.input
class InvoiceInput:
    """Input type for invoice data"""
    id: str
    amount: str
    currency: str
    invoice_date: Optional[datetime] = None
    description: Optional[str] = None
    invoice_number: Optional[str] = None
    vendor_name: Optional[str] = None


@strawberry.input
class TransactionInput:
    """Input type for bank transaction data"""
    id: str
    amount: str
    currency: str
    posted_at: datetime
    description: Optional[str] = None


@strawberry.input
class ScoreCandidatesInput:
    """Input for scoring candidates"""
    tenant_id: str
    invoices: List[InvoiceInput]
    transactions: List[TransactionInput]
    top_n: int = 5


@strawberry.type
class ScoreCandidatesResponse:
    """Response type for scoring operation"""
    candidates: List[MatchCandidateType]
    total_processed: int
    processing_time_ms: float


# ========================================

@strawberry.type
class Query:
    @strawberry.field
    def health(self) -> str:
        """Health check endpoint"""
        return "OK"
    
    @strawberry.field
    def version(self) -> str:
        """API version"""
        return "1.0.0"


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def score_candidates(
        self,
        input: ScoreCandidatesInput,
        info: strawberry.Info
    ) -> ScoreCandidatesResponse:
        """
        Score match candidates between invoices and transactions
        
        This is the main reconciliation endpoint. It receives invoices and transactions,
        applies deterministic scoring heuristics, and returns ranked match candidates.
        """
        import time
        from app.engine.scorer import ReconciliationScorer
        
        start_time = time.time()
        
        # Get scorer from context (injected by FastAPI)
        scorer: ReconciliationScorer = info.context.get("scorer")
        
        if not scorer:
            # Fallback: create scorer with default settings
            scorer = ReconciliationScorer()
        
        # Convert input to dict format for scorer
        invoices = [
            {
                'id': inv.id,
                'amount': inv.amount,
                'currency': inv.currency,
                'invoice_date': inv.invoice_date,
                'description': inv.description,
                'invoice_number': inv.invoice_number,
                'vendor_name': inv.vendor_name,
            }
            for inv in input.invoices
        ]
        
        transactions = [
            {
                'id': txn.id,
                'amount': txn.amount,
                'currency': txn.currency,
                'posted_at': txn.posted_at,
                'description': txn.description,
            }
            for txn in input.transactions
        ]
        
        # Score candidates
        candidates = scorer.score_candidates(
            invoices=invoices,
            transactions=transactions,
            top_n=input.top_n
        )
        
        # Convert to GraphQL types
        candidate_types = [
            MatchCandidateType(
                invoice_id=c.invoice_id,
                transaction_id=c.transaction_id,
                score=c.score,
                amount_score=c.amount_score,
                date_score=c.date_score,
                text_score=c.text_score,
                explanation=c.explanation
            )
            for c in candidates
        ]
        
        processing_time = (time.time() - start_time) * 1000
        
        return ScoreCandidatesResponse(
            candidates=candidate_types,
            total_processed=len(invoices) * len(transactions),
            processing_time_ms=round(processing_time, 2)
        )


# Create schema
schema = strawberry.Schema(query=Query, mutation=Mutation)