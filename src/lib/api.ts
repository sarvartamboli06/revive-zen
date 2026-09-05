/**
 * Real API layer for RecoverAI.
 * Connects directly to FastAPI backend (http://localhost:8000)
 * with robust local cache & fallback.
 */

import {
  auditTrail as seedAudit,
  customers as seedCustomers,
  defaultSettings,
  failureReasonSeries,
  methodSeries,
  performanceSeries,
  recoveryCases as seedCases,
  recoveryRateSeries,
  transactions as seedTransactions,
} from "@/data/mock";
import { apiClient } from "@/lib/api-client";
import type {
  AuditEntry,
  Customer,
  RecoveryCase,
  Settings,
  Transaction,
} from "@/lib/types";

export interface AppState {
  cases: RecoveryCase[];
  transactions: Transaction[];
  customers: Customer[];
  audit: AuditEntry[];
  settings: Settings;
  authenticated: boolean;
  isBackendConnected: boolean;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let state: AppState = {
  cases: clone(seedCases),
  transactions: clone(seedTransactions),
  customers: clone(seedCustomers),
  audit: clone(seedAudit),
  settings: { ...defaultSettings },
  authenticated: false,
  isBackendConnected: false,
};

const listeners = new Set<() => void>();

function commit(next: AppState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

// ----------------------------------------------------------------------
// Backend Model Mappers
// ----------------------------------------------------------------------
function mapCase(c: any): RecoveryCase {
  const caseId = c.case_id || c.caseId || c.id;
  const rawTimeline = Array.isArray(c.timeline) ? c.timeline : [];
  const timeline = rawTimeline.map((t: any) => ({
    at: t.at || t.created_at || new Date().toISOString(),
    label: t.label || t.event || "Event",
    detail: t.detail || t.result || "",
    kind: (t.kind === "ai" || t.kind === "human" || t.kind === "system" ? t.kind : "system") as "ai" | "human" | "system",
  }));

  const aiReasoning = Array.isArray(c.aiReasoning)
    ? c.aiReasoning
    : c.ai_reason
      ? [c.ai_reason]
      : [];

  return {
    id: caseId,
    customerId: c.customer_id || c.customerId || "",
    customerName: c.customer_name || c.customerName || "Customer",
    transactionId: c.transaction_id || c.transactionId || "",
    amount: Number(c.amount || 0),
    problem: (c.problem_type || c.problem || "Payment Failed") as any,
    failureReason: c.ai_reason || c.failureReason || c.failure_reason || "",
    probability: Number(c.recovery_probability ?? c.probability ?? 0),
    priority: (c.priority || "Medium") as any,
    status: (c.status || "Detected") as any,
    attempts: Number(c.attempts || 0),
    contacts: Number(c.contacts || 0),
    createdAt: c.created_at || c.createdAt || new Date().toISOString(),
    method: c.method || c.payment_method || "Payment Link",
    aiDecision: (c.ai_decision || c.aiDecision || "Pending Analysis") as any,
    aiReasoning,
    recommendedAction: (c.recommended_action || c.recommendedAction || "Send Smart Payment Link") as any,
    paymentLink: c.payment_link || c.paymentLink || undefined,
    timeline,
  };
}

function mapTransaction(tx: any): Transaction {
  return {
    id: tx.transaction_id || tx.id,
    customerId: tx.customer_id || tx.customerId || "",
    customerName: tx.customerName || tx.customer_name || "Unknown",
    amount: Number(tx.amount || 0),
    method: tx.payment_method || tx.method || "Card/UPI",
    date: tx.created_at || tx.date || new Date().toISOString(),
    status: (tx.status || "Failed") as any,
    failureReason: tx.failure_reason || tx.failureReason || null,
    recoveryStatus: tx.recovery_status || tx.recoveryStatus || "Not Started",
  };
}

function mapCustomer(cust: any): Customer {
  return {
    id: cust.id,
    name: cust.name,
    email: cust.email,
    phone: cust.phone || "",
    city: cust.city || "Mumbai",
    segment: (cust.segment || "SMB") as any,
    lifetimeValue: Number(cust.total_revenue || cust.lifetimeValue || 0),
    totalPayments: Number(cust.total_transactions || cust.totalPayments || 0),
    failedPayments: Number(cust.failed_payments || cust.failedPayments || 0),
    recoveredRevenue: Number(cust.recovered_revenue || cust.recoveredRevenue || 0),
  };
}

function mapAudit(a: any): AuditEntry {
  return {
    id: String(a.id || `AUD-${Math.random().toString(36).slice(2, 7)}`),
    timestamp: a.created_at || a.timestamp || new Date().toISOString(),
    caseId: a.case_id || a.caseId || "",
    event: a.event || "",
    decision: a.decision || "",
    action: a.action || "",
    result: a.result || "",
    actor: (a.performed_by || a.actor || "AI Agent") as any,
  };
}

// ----------------------------------------------------------------------
// Backend Sync
// ----------------------------------------------------------------------
export async function syncWithBackend(): Promise<boolean> {
  try {
    const [casesRes, txRes, custRes, auditRes] = await Promise.all([
      apiClient.getRecoveryCases(),
      apiClient.getTransactions(),
      apiClient.getCustomers(),
      apiClient.getAuditLogs(),
    ]);

    const mappedCases = Array.isArray(casesRes) ? casesRes.map(mapCase) : state.cases;
    const mappedTx = Array.isArray(txRes) ? txRes.map(mapTransaction) : state.transactions;
    const mappedCust = Array.isArray(custRes) ? custRes.map(mapCustomer) : state.customers;
    const mappedAudit = Array.isArray(auditRes) ? auditRes.map(mapAudit) : state.audit;

    commit({
      ...state,
      cases: mappedCases,
      transactions: mappedTx,
      customers: mappedCust,
      audit: mappedAudit,
      isBackendConnected: true,
    });
    return true;
  } catch (err) {
    console.warn("[RecoverAI] Backend unreachable; using local cache/seed data.", err);
    return false;
  }
}

// Auto-sync on client load and periodic poll for live webhooks
if (typeof window !== "undefined") {
  syncWithBackend();
  // Poll every 3 seconds for live background webhook updates
  setInterval(() => {
    syncWithBackend();
  }, 3000);
  window.addEventListener("focus", () => {
    syncWithBackend();
  });
}


/* ------------------------------------------------------------------ */
/* Guardrails                                                          */
/* ------------------------------------------------------------------ */
export interface GuardrailState {
  attemptsUsed: number;
  maxAttempts: number;
  contactsUsed: number;
  maxContacts: number;
  windowHours: number;
  hoursElapsed: number;
  highValue: boolean;
  highValueThreshold: number;
  attemptLimitReached: boolean;
  contactLimitReached: boolean;
  windowExpired: boolean;
  needsApproval: boolean;
  recoveryDisabled: boolean;
  reasons: string[];
}

export function evaluateGuardrails(c: RecoveryCase, settings: Settings): GuardrailState {
  const hoursElapsed = Math.max(
    0,
    (Date.now() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60),
  );
  const attemptLimitReached = c.attempts >= settings.maxAttempts;
  const contactLimitReached = c.contacts >= settings.maxContacts;
  const windowExpired = hoursElapsed > settings.recoveryWindowHours;
  const highValue = c.amount > settings.highValueThreshold;
  const needsApproval = highValue && c.status !== "Escalated";
  const reasons: string[] = [];
  if (attemptLimitReached) reasons.push("Maximum recovery attempts reached (limit reached).");
  if (contactLimitReached) reasons.push("Maximum customer contacts reached.");
  if (windowExpired) reasons.push("Recovery window has expired.");
  if (highValue) reasons.push("Amount is above the high-value threshold — human approval needed.");
  if (c.status === "Recovered") reasons.push("Payment already recovered.");
  if (c.status === "Stopped") reasons.push("Recovery was stopped for this case.");
  return {
    attemptsUsed: c.attempts,
    maxAttempts: settings.maxAttempts,
    contactsUsed: c.contacts,
    maxContacts: settings.maxContacts,
    windowHours: settings.recoveryWindowHours,
    hoursElapsed,
    highValue,
    highValueThreshold: settings.highValueThreshold,
    attemptLimitReached,
    contactLimitReached,
    windowExpired,
    needsApproval,
    recoveryDisabled:
      attemptLimitReached ||
      contactLimitReached ||
      windowExpired ||
      highValue ||
      c.status === "Recovered" ||
      c.status === "Stopped",
    reasons,
  };
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */
export interface DashboardMetrics {
  revenueAtRisk: number;
  revenueRecovered: number;
  recoveryRate: number;
  activeCases: number;
  customersRecovered: number;
  escalatedCases: number;
}

export function getDashboard(): DashboardMetrics {
  const { cases } = state;
  const recoveredCases = cases.filter((c) => c.status === "Recovered");
  const atRiskCases = cases.filter(
    (c) => c.status !== "Recovered" && c.status !== "Stopped",
  );
  const revenueAtRisk = atRiskCases.reduce((s, c) => s + c.amount, 0);
  const revenueRecovered = recoveredCases.reduce((s, c) => s + c.amount, 0);
  const total = revenueAtRisk + revenueRecovered;
  return {
    revenueAtRisk,
    revenueRecovered,
    recoveryRate: total ? Math.round((revenueRecovered / total) * 1000) / 10 : 0,
    activeCases: atRiskCases.length,
    customersRecovered: new Set(recoveredCases.map((c) => c.customerId)).size,
    escalatedCases: cases.filter((c) => c.status === "Escalated").length,
  };
}

export const getTransactions = () => state.transactions;
export const getRecoveryCases = () => state.cases;
export const getCase = (id: string) => state.cases.find((c) => c.id === id);
export const getCustomers = () => state.customers;
export const getAudit = () => state.audit;
export const getSettings = () => state.settings;
export const charts = {
  performanceSeries,
  recoveryRateSeries,
  failureReasonSeries,
  methodSeries,
};

/* ------------------------------------------------------------------ */
/* Writes & Actions connected to FastAPI Backend                      */
/* ------------------------------------------------------------------ */
export function login() {
  commit({ ...state, authenticated: true });
}

export function logout() {
  commit({ ...state, authenticated: false });
}

export function updateSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function analyzeCase(id: string): Promise<RecoveryCase> {
  try {
    await apiClient.analyzeCase(id);
    await syncWithBackend();
  } catch (err) {
    console.warn(`[API] analyzeCase fallback for ${id}:`, err);
  }
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  return current;
}

export async function generatePaymentLink(id: string): Promise<RecoveryCase> {
  try {
    await apiClient.generatePaymentLink(id);
    await syncWithBackend();
  } catch (err) {
    console.warn(`[API] generatePaymentLink fallback for ${id}:`, err);
  }
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  return current;
}

export async function executeRecovery(id: string): Promise<RecoveryCase> {
  try {
    await apiClient.executeRecovery(id);
    await syncWithBackend();
  } catch (err) {
    console.warn(`[API] executeRecovery error for ${id}:`, err);
    throw err;
  }
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  return current;
}

export async function markRecovered(id: string): Promise<RecoveryCase> {
  try {
    await apiClient.markRecovered(id);
    await syncWithBackend();
  } catch (err) {
    console.warn(`[API] markRecovered fallback for ${id}:`, err);
  }
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  return current;
}

export async function escalateCase(id: string, note?: string): Promise<RecoveryCase> {
  try {
    await apiClient.escalateCase(id, note);
    await syncWithBackend();
  } catch (err) {
    console.warn(`[API] escalateCase fallback for ${id}:`, err);
  }
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  return current;
}

export async function stopRecovery(id: string, reason?: string): Promise<RecoveryCase> {
  try {
    await apiClient.stopRecovery(id, reason);
    await syncWithBackend();
  } catch (err) {
    console.warn(`[API] stopRecovery fallback for ${id}:`, err);
  }
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  return current;
}

export async function refreshData(): Promise<void> {
  await syncWithBackend();
  listeners.forEach((l) => l());
}
