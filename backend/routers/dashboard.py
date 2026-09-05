"""Dashboard Router."""

from fastapi import APIRouter
from backend.database import db
from backend.models.schemas import DashboardMetrics

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("", response_model=DashboardMetrics)
def get_dashboard_metrics():
    """Calculate and return key recovery platform metrics:

    - revenue_at_risk
    - revenue_recovered
    - recovery_rate
    - active_cases
    - customers_recovered
    - escalated_cases
    """
    cases = db.fetch_all("recovery_cases")
    
    recovered_cases = [c for c in cases if str(c.get("status", "")).capitalize() == "Recovered"]
    active_cases = [
        c for c in cases 
        if str(c.get("status", "")).capitalize() not in ("Recovered", "Stopped")
    ]
    escalated_cases = [
        c for c in cases 
        if str(c.get("status", "")).capitalize() == "Escalated"
    ]

    revenue_at_risk = round(sum(float(c.get("amount", 0)) for c in active_cases), 2)
    revenue_recovered = round(sum(float(c.get("amount", 0)) for c in recovered_cases), 2)
    total_revenue_pool = revenue_at_risk + revenue_recovered

    recovery_rate = (
        round((revenue_recovered / total_revenue_pool) * 100.0, 1)
        if total_revenue_pool > 0
        else 0.0
    )

    customers_recovered = len(set(c.get("customer_id") for c in recovered_cases if c.get("customer_id")))

    return DashboardMetrics(
        revenue_at_risk=revenue_at_risk,
        revenue_recovered=revenue_recovered,
        recovery_rate=recovery_rate,
        active_cases=len(active_cases),
        customers_recovered=customers_recovered,
        escalated_cases=len(escalated_cases),
        # camelCase mirrors for frontend
        revenueAtRisk=revenue_at_risk,
        revenueRecovered=revenue_recovered,
        recoveryRate=recovery_rate,
        activeCases=len(active_cases),
        customersRecovered=customers_recovered,
        escalatedCases=len(escalated_cases),
    )
