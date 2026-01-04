from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from fuzzywuzzy import fuzz
import logging

logger = logging.getLogger(__name__)


class MatchCandidate:
    """Represents a potential match between an invoice and bank transaction"""
    
    def __init__(
        self,
        invoice_id: str,
        transaction_id: str,
        score: float,
        amount_score: float,
        date_score: float,
        text_score: float,
        explanation: str
    ):
        self.invoice_id = invoice_id
        self.transaction_id = transaction_id
        self.score = score
        self.amount_score = amount_score
        self.date_score = date_score
        self.text_score = text_score
        self.explanation = explanation


class ReconciliationScorer:
    """
    Deterministic scoring engine for invoice-transaction matching
    
    Scoring components:
    1. Amount matching (exact or within tolerance)
    2. Date proximity (within configurable days)
    3. Text similarity (description matching)
    """
    
    def __init__(
        self,
        amount_exact_weight: float = 0.4,
        amount_close_weight: float = 0.2,
        date_proximity_weight: float = 0.3,
        text_similarity_weight: float = 0.3,
        amount_tolerance_percent: float = 2.0,
        date_proximity_days: int = 3,
    ):
        self.amount_exact_weight = amount_exact_weight
        self.amount_close_weight = amount_close_weight
        self.date_proximity_weight = date_proximity_weight
        self.text_similarity_weight = text_similarity_weight
        self.amount_tolerance_percent = amount_tolerance_percent
        self.date_proximity_days = date_proximity_days

    def calculate_amount_score(self, invoice_amount: Decimal, transaction_amount: Decimal) -> tuple[float, str]:
        """
        Calculate amount matching score
        
        Returns: (score, explanation)
        """
        if invoice_amount == transaction_amount:
            return 1.0, "Exact amount match"
        
        # Calculate percentage difference
        diff = abs(invoice_amount - transaction_amount)
        avg = (invoice_amount + transaction_amount) / 2
        percent_diff = float((diff / avg) * 100 if avg > 0 else 100)
        
        if percent_diff <= self.amount_tolerance_percent:
            # Within tolerance - partial score
            score = 1.0 - (percent_diff / self.amount_tolerance_percent) * 0.5
            return score, f"Amount within {percent_diff:.1f}% tolerance"
        
        # Outside tolerance - very low score but not zero
        score = max(0.0, 1.0 - (percent_diff / 100))
        return score, f"Amount differs by {percent_diff:.1f}%"

    def calculate_date_score(
        self,
        invoice_date: Optional[datetime],
        transaction_date: datetime
    ) -> tuple[float, str]:
        """
        Calculate date proximity score
        
        Returns: (score, explanation)
        """
        if invoice_date is None:
            return 0.5, "Invoice date not available"
        
        # Remove timezone info for comparison
        if invoice_date.tzinfo:
            invoice_date = invoice_date.replace(tzinfo=None)
        if transaction_date.tzinfo:
            transaction_date = transaction_date.replace(tzinfo=None)
        
        days_diff = abs((invoice_date - transaction_date).days)
        
        if days_diff == 0:
            return 1.0, "Same day transaction"
        
        if days_diff <= self.date_proximity_days:
            # Within proximity window - linear decay
            score = 1.0 - (days_diff / self.date_proximity_days) * 0.5
            return score, f"Transaction {days_diff} days from invoice date"
        
        # Outside window - decreasing score
        score = max(0.0, 1.0 - (days_diff / 30))
        return score, f"Transaction {days_diff} days from invoice date"

    def calculate_text_score(
        self,
        invoice_desc: Optional[str],
        transaction_desc: Optional[str],
        invoice_number: Optional[str] = None,
        vendor_name: Optional[str] = None
    ) -> tuple[float, str]:
        """
        Calculate text similarity score using fuzzy matching
        
        Returns: (score, explanation)
        """
        # Collect all text fields to compare
        invoice_texts = []
        if invoice_desc:
            invoice_texts.append(invoice_desc.lower())
        if invoice_number:
            invoice_texts.append(invoice_number.lower())
        if vendor_name:
            invoice_texts.append(vendor_name.lower())
        
        if not transaction_desc or not invoice_texts:
            return 0.3, "Insufficient text data for comparison"
        
        transaction_text = transaction_desc.lower()
        
        # Calculate similarity scores
        max_score = 0.0
        best_match = ""
        
        for invoice_text in invoice_texts:
            # Use fuzzy ratio
            ratio = fuzz.partial_ratio(invoice_text, transaction_text) / 100.0
            if ratio > max_score:
                max_score = ratio
                best_match = invoice_text[:50]
        
        # Also check if invoice number appears in transaction
        if invoice_number and invoice_number.lower() in transaction_text:
            max_score = max(max_score, 0.9)
            best_match = f"Invoice number '{invoice_number}' found in description"
        
        # Check vendor name match
        if vendor_name and vendor_name.lower() in transaction_text:
            max_score = max(max_score, 0.85)
            best_match = f"Vendor name '{vendor_name}' found in description"
        
        explanation = f"Text similarity: {int(max_score * 100)}%"
        if best_match:
            explanation += f" (matched: {best_match})"
        
        return max_score, explanation

    def score_match(
        self,
        invoice_id: str,
        invoice_amount: Decimal,
        invoice_date: Optional[datetime],
        invoice_desc: Optional[str],
        invoice_number: Optional[str],
        vendor_name: Optional[str],
        transaction_id: str,
        transaction_amount: Decimal,
        transaction_date: datetime,
        transaction_desc: Optional[str],
    ) -> MatchCandidate:
        """
        Score a potential invoice-transaction match
        
        Returns: MatchCandidate with score and explanation
        """
        # Calculate component scores
        amount_score, amount_explanation = self.calculate_amount_score(
            invoice_amount, transaction_amount
        )
        
        date_score, date_explanation = self.calculate_date_score(
            invoice_date, transaction_date
        )
        
        text_score, text_explanation = self.calculate_text_score(
            invoice_desc, transaction_desc, invoice_number, vendor_name
        )
        
        # Calculate weighted total score
        # Amount matching is most important, then date, then text
        total_score = (
            amount_score * self.amount_exact_weight +
            date_score * self.date_proximity_weight +
            text_score * self.text_similarity_weight
        )
        
        # Normalize to 0-100 scale
        total_score = min(100.0, total_score * 100)
        
        # Build explanation
        explanation_parts = [
            f"Amount: {amount_explanation}",
            f"Date: {date_explanation}",
            f"Text: {text_explanation}",
            f"Overall confidence: {total_score:.1f}%"
        ]
        
        explanation = " | ".join(explanation_parts)
        
        logger.debug(
            f"Scored match: Invoice {invoice_id[:8]} <-> Transaction {transaction_id[:8]} "
            f"= {total_score:.1f} (amount: {amount_score:.2f}, date: {date_score:.2f}, text: {text_score:.2f})"
        )
        
        return MatchCandidate(
            invoice_id=invoice_id,
            transaction_id=transaction_id,
            score=total_score,
            amount_score=amount_score * 100,
            date_score=date_score * 100,
            text_score=text_score * 100,
            explanation=explanation
        )

    def score_candidates(
        self,
        invoices: List[dict],
        transactions: List[dict],
        top_n: int = 5
    ) -> List[MatchCandidate]:
        """
        Score all possible matches and return top N candidates
        
        Args:
            invoices: List of invoice dicts
            transactions: List of transaction dicts
            top_n: Number of top matches to return per invoice
            
        Returns: List of MatchCandidate objects sorted by score
        """
        all_candidates = []
        
        for invoice in invoices:
            invoice_candidates = []
            
            for transaction in transactions:
                # Skip if currencies don't match
                if invoice.get('currency') != transaction.get('currency'):
                    continue
                
                candidate = self.score_match(
                    invoice_id=str(invoice['id']),
                    invoice_amount=Decimal(str(invoice['amount'])),
                    invoice_date=invoice.get('invoice_date'),
                    invoice_desc=invoice.get('description'),
                    invoice_number=invoice.get('invoice_number'),
                    vendor_name=invoice.get('vendor_name'),
                    transaction_id=str(transaction['id']),
                    transaction_amount=Decimal(str(transaction['amount'])),
                    transaction_date=transaction['posted_at'],
                    transaction_desc=transaction.get('description'),
                )
                
                invoice_candidates.append(candidate)
            
            # Sort by score and take top N for this invoice
            invoice_candidates.sort(key=lambda x: x.score, reverse=True)
            all_candidates.extend(invoice_candidates[:top_n])
        
        # Sort all candidates by score
        all_candidates.sort(key=lambda x: x.score, reverse=True)
        
        logger.info(f"Generated {len(all_candidates)} match candidates")
        
        return all_candidates