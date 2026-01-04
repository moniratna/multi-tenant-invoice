import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from app.engine.scorer import ReconciliationScorer


@pytest.fixture
def scorer():
    """Create scorer with default settings"""
    return ReconciliationScorer()


def test_exact_amount_match(scorer):
    """Test exact amount matching gets high score"""
    score, explanation = scorer.calculate_amount_score(
        Decimal("1000.00"),
        Decimal("1000.00")
    )
    assert score == 1.0
    assert "Exact" in explanation


def test_close_amount_match(scorer):
    """Test amount within tolerance gets good score"""
    score, explanation = scorer.calculate_amount_score(
        Decimal("1000.00"),
        Decimal("1010.00")  # 1% difference
    )
    assert score > 0.7  # Should be high but not perfect
    assert "tolerance" in explanation


def test_amount_outside_tolerance(scorer):
    """Test amount outside tolerance gets low score"""
    score, explanation = scorer.calculate_amount_score(
        Decimal("1000.00"),
        Decimal("1500.00")  # 50% difference
    )
    assert score < 0.5


def test_same_day_date_match(scorer):
    """Test same day transaction gets perfect score"""
    date = datetime(2024, 1, 15)
    score, explanation = scorer.calculate_date_score(date, date)
    assert score == 1.0
    assert "Same day" in explanation


def test_date_within_proximity(scorer):
    """Test date within proximity window"""
    invoice_date = datetime(2024, 1, 15)
    transaction_date = datetime(2024, 1, 17)  # 2 days later
    
    score, explanation = scorer.calculate_date_score(invoice_date, transaction_date)
    assert score > 0.5
    assert "2 days" in explanation


def test_date_outside_proximity(scorer):
    """Test date outside proximity window"""
    invoice_date = datetime(2024, 1, 15)
    transaction_date = datetime(2024, 2, 15)  # 31 days later
    
    score, explanation = scorer.calculate_date_score(invoice_date, transaction_date)
    assert score < 0.5


def test_text_exact_match(scorer):
    """Test exact text match"""
    score, explanation = scorer.calculate_text_score(
        "Payment for Invoice INV-001",
        "Payment for Invoice INV-001"
    )
    assert score > 0.9


def test_text_partial_match(scorer):
    """Test partial text match"""
    score, explanation = scorer.calculate_text_score(
        "Office supplies",
        "Payment for office supplies and equipment"
    )
    assert score > 0.5


def test_invoice_number_in_description(scorer):
    """Test invoice number found in transaction description"""
    score, explanation = scorer.calculate_text_score(
        invoice_desc="Office supplies",
        transaction_desc="Payment ref INV-12345",
        invoice_number="INV-12345"
    )
    assert score >= 0.9
    assert "INV-12345" in explanation


def test_vendor_name_in_description(scorer):
    """Test vendor name found in transaction description"""
    score, explanation = scorer.calculate_text_score(
        invoice_desc="Monthly service",
        transaction_desc="Payment to Acme Corp",
        vendor_name="Acme Corp"
    )
    assert score >= 0.85


def test_no_text_data(scorer):
    """Test handling of missing text data"""
    score, explanation = scorer.calculate_text_score(None, None)
    assert score > 0
    assert "Insufficient" in explanation


def test_full_match_scoring(scorer):
    """Test complete match scoring"""
    candidate = scorer.score_match(
        invoice_id="inv-1",
        invoice_amount=Decimal("1000.00"),
        invoice_date=datetime(2024, 1, 15),
        invoice_desc="Office supplies",
        invoice_number="INV-001",
        vendor_name="Acme Corp",
        transaction_id="txn-1",
        transaction_amount=Decimal("1000.00"),
        transaction_date=datetime(2024, 1, 15),
        transaction_desc="Payment for INV-001 to Acme Corp"
    )
    
    assert candidate.score > 80  # Should be high confidence
    assert candidate.invoice_id == "inv-1"
    assert candidate.transaction_id == "txn-1"
    assert "Exact amount" in candidate.explanation


def test_poor_match_scoring(scorer):
    """Test poor match gets low score"""
    candidate = scorer.score_match(
        invoice_id="inv-1",
        invoice_amount=Decimal("1000.00"),
        invoice_date=datetime(2024, 1, 15),
        invoice_desc="Office supplies",
        invoice_number="INV-001",
        vendor_name="Acme Corp",
        transaction_id="txn-1",
        transaction_amount=Decimal("5000.00"),
        transaction_date=datetime(2024, 3, 15),
        transaction_desc="Unrelated payment"
    )
    
    assert candidate.score < 50  # Should be low confidence


def test_score_candidates_returns_top_n(scorer):
    """Test that score_candidates returns top N matches"""
    invoices = [
        {
            'id': 'inv-1',
            'amount': '1000.00',
            'currency': 'USD',
            'invoice_date': datetime(2024, 1, 15),
            'description': 'Invoice 1',
            'invoice_number': 'INV-001',
            'vendor_name': None
        }
    ]
    
    transactions = [
        {
            'id': 'txn-1',
            'amount': '1000.00',
            'currency': 'USD',
            'posted_at': datetime(2024, 1, 15),
            'description': 'Perfect match'
        },
        {
            'id': 'txn-2',
            'amount': '1010.00',
            'currency': 'USD',
            'posted_at': datetime(2024, 1, 16),
            'description': 'Close match'
        },
        {
            'id': 'txn-3',
            'amount': '2000.00',
            'currency': 'USD',
            'posted_at': datetime(2024, 2, 15),
            'description': 'Poor match'
        }
    ]
    
    candidates = scorer.score_candidates(invoices, transactions, top_n=2)
    
    assert len(candidates) == 2
    # First candidate should be the best match
    assert candidates[0].score > candidates[1].score


def test_currency_mismatch_skipped(scorer):
    """Test that different currencies are not matched"""
    invoices = [
        {
            'id': 'inv-1',
            'amount': '1000.00',
            'currency': 'USD',
            'invoice_date': datetime(2024, 1, 15),
            'description': 'Invoice 1',
            'invoice_number': None,
            'vendor_name': None
        }
    ]
    
    transactions = [
        {
            'id': 'txn-1',
            'amount': '1000.00',
            'currency': 'EUR',  # Different currency
            'posted_at': datetime(2024, 1, 15),
            'description': 'Payment'
        }
    ]
    
    candidates = scorer.score_candidates(invoices, transactions, top_n=5)
    
    assert len(candidates) == 0