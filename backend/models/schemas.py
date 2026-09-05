"""Pydantic schemas for RecoverAI API requests and responses."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# ----------------------------------------------------------------------
# Generic & Health Schemas
# ----------------------------------------------------------------------
class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "RecoverAI Backend"
    ai_agent: str = "operational"
    database: Optional[Dict[str, Any]] = None

class ErrorResponse(BaseModel):
    success: bool = False
    error: str

class SuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

# ----------------------------------------------------------------------
# Customer Schemas
# ----------------------------------------------------------------------
class CustomerBase(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    city: Optional[str] = None
    segment: Optional[str] = "SMB"

class CustomerCreate(CustomerBase):
    total_transactions: Optional[int] = 0
    successful_payments: Optional[int] = 0
    failed_payments: Optional[int] = 0
    total_revenue: Optional[float] = 0.0
    recovered_revenue: Optional[float] = 0.0

class CustomerResponse(CustomerBase):
    total_transactions: int = 0
    successful_payments: int = 0
    failed_payments: int = 0
    total_revenue: float = 0.0
    recovered_revenue: float = 0.0
    created_at: Optional[str] = None

    # Frontend camelCase compatibility fields
    lifetimeValue: Optional[float] = None
    totalPayments: Optional[int] = None
    failedPayments: Optional[int] = None
    recoveredRevenue: Optional[float] = None

# ----------------------------------------------------------------------
# Transaction Schemas
# ----------------------------------------------------------------------
class TransactionCreate(BaseModel):
    transaction_id: str
    customer_id: str
    amount: float
    payment_method: str
    status: str = "Failed"  # Success, Failed, Abandoned, Recovered
    failure_reason: Optional[str] = None
    recovery_status: Optional[str] = "Not Started"

class TransactionUpdate(BaseModel):
    status: Optional[str] = None
    recovery_status: Optional[str] = None
    failure_reason: Optional[str] = None
    amount: Optional[float] = None
    payment_method: Optional[str] = None

class TransactionResponse(BaseModel):
    id: Optional[int] = None
    transaction_id: str
    customer_id: str
    amount: float
    payment_method: str
    status: str
    failure_reason: Optional[str] = None
    recovery_status: str = "Not Started"
    created_at: Optional[str] = None

    # Frontend camelCase compatibility
    customerId: Optional[str] = None
    customerName: Optional[str] = None
    method: Optional[str] = None
    failureReason: Optional[str] = None
    recoveryStatus: Optional[str] = None
    date: Optional[str] = None

# ----------------------------------------------------------------------
# Recovery Case Schemas
# ----------------------------------------------------------------------
class RecoveryCaseCreate(BaseModel):
    case_id: str
    transaction_id: str
    customer_id: str
    amount: float
    problem_type: Optional[str] = "Payment Failed"
    priority: Optional[str] = "Medium"
    ai_reason: Optional[str] = "Payment failure detected"

class RecoveryCaseResponse(BaseModel):
    id: Optional[int] = None
    case_id: str
    transaction_id: str
    customer_id: str
    customer_name: Optional[str] = None
    amount: float
    problem_type: str
    recovery_probability: int
    priority: str
    ai_decision: str
    ai_reason: Optional[str] = None
    recommended_action: str
    attempts: int = 0
    contacts: int = 0
    status: str
    payment_link: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    # Frontend camelCase compatibility
    caseId: Optional[str] = None
    customerId: Optional[str] = None
    customerName: Optional[str] = None
    transactionId: Optional[str] = None
    problem: Optional[str] = None
    probability: Optional[int] = None
    aiDecision: Optional[str] = None
    aiReasoning: Optional[List[str]] = None
    recommendedAction: Optional[str] = None
    paymentLink: Optional[str] = None
    timeline: Optional[List[Dict[str, Any]]] = None

class AnalyzeCaseResponse(BaseModel):
    case_id: str
    recovery_probability: int
    priority: str
    ai_decision: str
    recommended_action: str
    ai_reason: str

class ExecuteRecoveryRequest(BaseModel):
    action: Optional[str] = None
    note: Optional[str] = None

class ExecuteRecoveryResponse(BaseModel):
    success: bool
    case_id: str
    status: str
    attempts: int
    contacts: int
    action_taken: str
    audit_id: Optional[int] = None
    message: str

class PaymentLinkResponse(BaseModel):
    success: bool
    case_id: str
    payment_link: str
    amount: float
    status: str
    message: str

class EscalateRequest(BaseModel):
    note: Optional[str] = "High-value case escalated for manual review"

class StopRequest(BaseModel):
    reason: Optional[str] = "Recovery stopped manually"

# ----------------------------------------------------------------------
# Dashboard Metrics Schemas
# ----------------------------------------------------------------------
class DashboardMetrics(BaseModel):
    revenue_at_risk: float
    revenue_recovered: float
    recovery_rate: float
    active_cases: int
    customers_recovered: int
    escalated_cases: int

    # Frontend camelCase mirrors
    revenueAtRisk: float
    revenueRecovered: float
    recoveryRate: float
    activeCases: int
    customersRecovered: int
    escalatedCases: int

# ----------------------------------------------------------------------
# Audit Log Schemas
# ----------------------------------------------------------------------
class AuditLogResponse(BaseModel):
    id: Optional[int] = None
    case_id: str
    event: str
    decision: Optional[str] = None
    action: Optional[str] = None
    performed_by: str = "AI Agent"
    result: Optional[str] = None
    created_at: Optional[str] = None

    # Frontend camelCase
    caseId: Optional[str] = None
    actor: Optional[str] = None
    timestamp: Optional[str] = None

# ----------------------------------------------------------------------
# Webhook Schemas
# ----------------------------------------------------------------------
class RazorpayWebhookPayload(BaseModel):
    event: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
