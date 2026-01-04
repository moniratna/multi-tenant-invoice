import pytest
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_query():
    """Test GraphQL health query"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/graphql",
            json={
                "query": "{ health }"
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["health"] == "OK"


@pytest.mark.asyncio
async def test_version_query():
    """Test GraphQL version query"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/graphql",
            json={
                "query": "{ version }"
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert "version" in data["data"]


@pytest.mark.asyncio
async def test_score_candidates_mutation():
    """Test score candidates mutation"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        mutation = """
        mutation ScoreCandidates($input: ScoreCandidatesInput!) {
          scoreCandidates(input: $input) {
            candidates {
              invoiceId
              transactionId
              score
              explanation
            }
            totalProcessed
            processingTimeMs
          }
        }
        """
        
        variables = {
            "input": {
                "tenantId": "test-tenant",
                "invoices": [
                    {
                        "id": "inv-1",
                        "amount": "1000.00",
                        "currency": "USD",
                        "invoiceDate": "2024-01-15T00:00:00Z",
                        "description": "Test invoice",
                        "invoiceNumber": "INV-001"
                    }
                ],
                "transactions": [
                    {
                        "id": "txn-1",
                        "amount": "1000.00",
                        "currency": "USD",
                        "postedAt": "2024-01-15T10:00:00Z",
                        "description": "Payment for INV-001"
                    }
                ],
                "topN": 5
            }
        }
        
        response = await client.post(
            "/graphql",
            json={
                "query": mutation,
                "variables": variables
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "scoreCandidates" in data["data"]
    
    result = data["data"]["scoreCandidates"]
    assert len(result["candidates"]) > 0
    assert result["candidates"][0]["score"] > 0
    assert result["totalProcessed"] == 1