"""RecoverAI - AI Revenue Recovery Platform Backend.

FastAPI application entry point providing health checks, CORS, OpenAPI documentation,
and unified routing for Dashboard, Transactions, Customers, Recovery Cases, Payments, and Audit.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.database import db
from backend.models.schemas import HealthResponse
from backend.routers import audit, customers, dashboard, payments, recovery, transactions

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("recoverai")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("Starting RecoverAI Backend...")
    conn_info = db.check_connection()
    if conn_info.get("connected"):
        logger.info("Supabase connected successfully. Detected tables: %s", conn_info.get("tables_detected"))
    else:
        logger.warning("Supabase status: %s", conn_info.get("error"))
    yield
    logger.info("RecoverAI Backend shutting down.")

app = FastAPI(
    title="RecoverAI – AI Revenue Recovery Platform",
    description="Automated, explainable revenue recovery engine for failed payments and checkout abandonment.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS for Lovable frontend and configured origins
origins = settings.cors_origins
logger.info("Configured CORS origins: %s", origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------------------------
# Clean JSON Error Handling
# ----------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Ensure all HTTP exceptions adhere to clean JSON error specification."""
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail,
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": str(exc.detail)},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled internal exceptions."""
    logger.exception("Unhandled server exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "error": f"Internal server error: {str(exc)}"},
    )

# ----------------------------------------------------------------------
# Health & Database Connection Endpoints
# ----------------------------------------------------------------------
@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Health check endpoint",
)
def health_check():
    """Returns the operational status of the service, AI agent, and Supabase connectivity."""
    db_status = db.check_connection()
    return HealthResponse(
        status="healthy" if db_status.get("connected") else "configuration_required",
        service="RecoverAI Backend",
        ai_agent="operational",
        database={
            "provider": "Supabase PostgreSQL",
            "connected": db_status.get("connected", False),
            "url": db_status.get("url"),
            "tables_detected": db_status.get("tables_detected", []),
            "error": db_status.get("error"),
        },
    )

@app.get(
    "/api/database/status",
    tags=["Health"],
    summary="Supabase database status and table inspection",
)
def database_status():
    """Detailed diagnostics of Supabase PostgreSQL connection and detected tables."""
    return db.check_connection()

@app.get(
    "/api/razorpay/status",
    tags=["Payments & Webhooks"],
    summary="Safe Razorpay configuration status",
)
def razorpay_direct_status():
    """Safe status of Razorpay configuration without exposing secret credentials."""
    from backend.services.razorpay_service import razorpay_service
    return razorpay_service.get_status()


# ----------------------------------------------------------------------
# Register Routers
# ----------------------------------------------------------------------
app.include_router(dashboard.router)
app.include_router(transactions.router)
app.include_router(customers.router)
app.include_router(recovery.router)
app.include_router(payments.router)
app.include_router(audit.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
