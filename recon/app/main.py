from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter
from contextlib import asynccontextmanager
import logging
import os
from dotenv import load_dotenv

from app.schema import schema
from app.engine.scorer import ReconciliationScorer
from app.database import engine, Base

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup/shutdown events
    """
    # Startup
    logger.info("Starting Python Reconciliation Engine...")
    
    # Create database tables (if not exists)
    # Note: In production, use Alembic migrations
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")
    
    # Initialize scorer with environment variables
    scorer = ReconciliationScorer(
        amount_exact_weight=float(os.getenv('AMOUNT_EXACT_WEIGHT', 0.4)),
        amount_close_weight=float(os.getenv('AMOUNT_CLOSE_WEIGHT', 0.2)),
        date_proximity_weight=float(os.getenv('DATE_PROXIMITY_WEIGHT', 0.3)),
        text_similarity_weight=float(os.getenv('TEXT_SIMILARITY_WEIGHT', 0.3)),
        amount_tolerance_percent=float(os.getenv('AMOUNT_TOLERANCE_PERCENT', 2.0)),
        date_proximity_days=int(os.getenv('DATE_PROXIMITY_DAYS', 3)),
    )
    
    app.state.scorer = scorer
    logger.info("Reconciliation scorer initialized")
    logger.info(f"Server starting on {os.getenv('HOST', '0.0.0.0')}:{os.getenv('PORT', 8000)}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Python Reconciliation Engine...")


# Create FastAPI app
app = FastAPI(
    title="Invoice Reconciliation Engine",
    description="Deterministic scoring engine for invoice-transaction matching",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# GraphQL context getter
async def get_context():
    """Inject dependencies into GraphQL context"""
    return {
        "scorer": app.state.scorer,
    }


# Mount GraphQL router
graphql_app = GraphQLRouter(
    schema,
    context_getter=get_context,
    graphiql=True,  # Enable GraphiQL interface
)

app.include_router(graphql_app, prefix="/graphql")


# REST endpoints for health checks
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Invoice Reconciliation Engine",
        "version": "1.0.0",
        "status": "running",
        "graphql_endpoint": "/graphql"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/config")
async def config():
    """Display current configuration (for debugging)"""
    scorer: ReconciliationScorer = app.state.scorer
    return {
        "scoring_weights": {
            "amount_exact": scorer.amount_exact_weight,
            "amount_close": scorer.amount_close_weight,
            "date_proximity": scorer.date_proximity_weight,
            "text_similarity": scorer.text_similarity_weight,
        },
        "tolerances": {
            "amount_tolerance_percent": scorer.amount_tolerance_percent,
            "date_proximity_days": scorer.date_proximity_days,
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "False").lower() == "true"
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )