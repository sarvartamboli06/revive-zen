/**
 * Mock API layer for RecoverAI.
 *
 * Every function here mirrors a future backend endpoint (FastAPI / Supabase):
 *
 *   GET  /api/dashboard
 *   GET  /api/transactions
 *   GET  /api/recovery-cases
 *   POST /api/recovery-cases/:id/analyze
 *   POST /api/recovery-cases/:id/execute
 *   POST /api/recovery-cases/:id/escalate
 *   POST /api/recovery-cases/:id/stop
 *   POST /api/recovery-cases/:id/payment-link
 *   GET  /api/audit
 *
 * Swapping to a real backend only requires replacing the bodies below with
 * fetch() calls — the UI never touches raw data directly.
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
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let state: AppState = {
  cases: clone(seedCases),
  transactions: clone(seedTransactions),
  customers: clone(seedCustomers),
  audit: clone(seedAudit),
  settings: { ...defaultSettings },
  authenticated: false,
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

const nowIso = () => new Date().toISOString();
let auditSeq = 7800;

function addAudit(
  entry: Omit<AuditEntry, "id" | "timestamp"> & { timestamp?: string },
): AuditEntry {
  return {
    id: `AUD-${++auditSeq}`,
    timestamp: entry.timestamp ?? nowIso(),
    caseId: entry.caseId,
    event: entry.event,
    decision: entry.decision,
    action: entry.action,
    result: entry.result,
    actor: entry.actor,
  };
}

function updateCase(id: string, updater: (c: RecoveryCase) => RecoveryCase, audit: AuditEntry[]) {
  const cases = state.cases.map((c) => (c.id === id ? updater(c) : c));
  commit({ ...state, cases, audit: [...audit, ...state.audit] });
  return cases.find((c) => c.id === id)!;
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
/* Writes                                                              */
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

function buildReasoning(c: RecoveryCase, settings: Settings) {
  const customer = state.customers.find((x) => x.id === c.customerId);
  const reasoning: string[] = [];
  reasoning.push(
    `The payment of ${formatINR(c.amount)} failed because of: ${c.failureReason.toLowerCase()}.`,
  );
  if (customer) {
    reasoning.push(
      `${customer.name} has completed ${customer.totalPayments} payments before, with ${customer.failedPayments} failures — this is a ${customer.failedPayments <= 3 ? "reliable" : "moderately risky"} payer.`,
    );
  }
  if (c.problem === "Checkout Abandoned") {
    reasoning.push("The customer left at the payment step, so a gentle reminder usually works.");
  } else if (c.problem === "Repeated Failure") {
    reasoning.push("The same payment has failed more than once, so another silent retry is unlikely to work.");
  } else {
    reasoning.push("This looks like a one-off failure that a fresh payment link can fix.");
  }
  if (c.amount > settings.highValueThreshold) {
    reasoning.push(
      `The amount is above the high-value limit of ${formatINR(settings.highValueThreshold)}, so a human must approve any recovery action.`,
    );
  }
  if (c.attempts >= settings.maxAttempts) {
    reasoning.push(
      `${c.attempts} of ${settings.maxAttempts} attempts have already been used, so automatic recovery is switched off.`,
    );
  }
  return reasoning;
}

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function analyzeCase(id: string) {
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  await delay(900);
  const settings = state.settings;
  const reasoning = buildReasoning(current, settings);

  let decision: RecoveryCase["aiDecision"] = "Auto Recovery Approved";
  let action: RecoveryCase["recommendedAction"] = "Send Smart Payment Link";
  let status: RecoveryCase["status"] = "Analyzed";

  if (current.attempts >= settings.maxAttempts) {
    decision = "Recovery Blocked";
    action = "Stop Recovery";
    status = "Stopped";
  } else if (current.amount > settings.highValueThreshold) {
    decision = "Human Review Required";
    action = "Escalate to Human Review";
  } else if (current.probability < settings.aiConfidenceThreshold) {
    decision = "Human Review Required";
    action = "Escalate to Human Review";
  } else if (current.problem === "Checkout Abandoned") {
    action = "Send Checkout Reminder";
  } else if (current.failureReason.toLowerCase().includes("3d secure")) {
    action = "Retry Payment on Backup Method";
  }

  return updateCase(
    id,
    (c) => ({
      ...c,
      status: c.status === "Recovered" ? c.status : status,
      aiDecision: decision,
      aiReasoning: reasoning,
      recommendedAction: action,
      timeline: [
        ...c.timeline,
        {
          at: nowIso(),
          label: "AI Analysed",
          detail: `Recovery probability ${c.probability}% — ${decision}.`,
          kind: "ai" as const,
        },
      ],
    }),
    [
      addAudit({
        caseId: id,
        event: "AI Analysed",
        decision,
        action,
        result: `Probability ${current.probability}%`,
        actor: "AI Agent",
      }),
    ],
  );
}

export async function generatePaymentLink(id: string) {
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  await delay(700);
  const link = `https://pay.recoverai.in/${id.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`;
  return updateCase(
    id,
    (c) => ({
      ...c,
      paymentLink: link,
      contacts: c.contacts + 1,
      status: c.status === "Recovered" ? c.status : "Recovery Initiated",
      timeline: [
        ...c.timeline,
        {
          at: nowIso(),
          label: "Payment Link Generated",
          detail: "Smart payment link sent to the customer on email and SMS.",
          kind: "ai" as const,
        },
      ],
    }),
    [
      addAudit({
        caseId: id,
        event: "Recovery Link Generated",
        decision: current.aiDecision,
        action: "Send Smart Payment Link",
        result: "Link delivered to customer",
        actor: "AI Agent",
      }),
    ],
  );
}

export async function executeRecovery(id: string) {
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  const guard = evaluateGuardrails(current, state.settings);
  if (guard.recoveryDisabled) {
    throw new Error(guard.reasons[0] ?? "Recovery is not allowed for this case.");
  }
  await delay(900);
  const attempts = current.attempts + 1;
  const limitHit = attempts >= state.settings.maxAttempts;
  return updateCase(
    id,
    (c) => ({
      ...c,
      attempts,
      contacts: c.contacts + 1,
      status: limitHit ? "Stopped" : "Recovery Initiated",
      timeline: [
        ...c.timeline,
        {
          at: nowIso(),
          label: `Recovery Attempt ${attempts}`,
          detail: `${c.recommendedAction} executed automatically.`,
          kind: "ai" as const,
        },
        ...(limitHit
          ? [
              {
                at: nowIso(),
                label: "Recovery Stopped",
                detail: `Attempt limit ${state.settings.maxAttempts}/${state.settings.maxAttempts} reached — automatic recovery disabled.`,
                kind: "system" as const,
              },
            ]
          : []),
      ],
    }),
    [
      addAudit({
        caseId: id,
        event: `Recovery Attempt ${attempts}`,
        decision: current.aiDecision,
        action: current.recommendedAction,
        result: limitHit ? "Attempt limit reached — recovery stopped" : "Recovery initiated",
        actor: "AI Agent",
      }),
    ],
  );
}

export async function markRecovered(id: string) {
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  await delay(800);
  const transactions = state.transactions.map((t) =>
    t.id === current.transactionId
      ? { ...t, status: "Recovered" as const, recoveryStatus: "Recovered by RecoverAI" }
      : t,
  );
  const customers = state.customers.map((cu) =>
    cu.id === current.customerId
      ? { ...cu, recoveredRevenue: cu.recoveredRevenue + current.amount }
      : cu,
  );
  const cases = state.cases.map((c) =>
    c.id === id
      ? {
          ...c,
          status: "Recovered" as const,
          timeline: [
            ...c.timeline,
            {
              at: nowIso(),
              label: "Payment Recovered",
              detail: `${formatINR(c.amount)} collected and verified.`,
              kind: "system" as const,
            },
          ],
        }
      : c,
  );
  commit({
    ...state,
    cases,
    transactions,
    customers,
    audit: [
      addAudit({
        caseId: id,
        event: "Payment Recovered",
        decision: current.aiDecision,
        action: current.recommendedAction,
        result: `${formatINR(current.amount)} recovered`,
        actor: "System",
      }),
      ...state.audit,
    ],
  });
  return cases.find((c) => c.id === id)!;
}

export async function escalateCase(id: string, note?: string) {
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  await delay(600);
  return updateCase(
    id,
    (c) => ({
      ...c,
      status: "Escalated",
      aiDecision: "Human Review Required",
      timeline: [
        ...c.timeline,
        {
          at: nowIso(),
          label: "Escalated to Human Review",
          detail: note?.trim() ? note.trim() : "Case handed to the revenue operations team.",
          kind: "human" as const,
        },
      ],
    }),
    [
      addAudit({
        caseId: id,
        event: "Escalated",
        decision: "Human Review Required",
        action: "Assign to revenue operations",
        result: "Awaiting human decision",
        actor: "Human",
      }),
    ],
  );
}

export async function stopRecovery(id: string, reason?: string) {
  const current = getCase(id);
  if (!current) throw new Error("Case not found");
  await delay(500);
  return updateCase(
    id,
    (c) => ({
      ...c,
      status: "Stopped",
      timeline: [
        ...c.timeline,
        {
          at: nowIso(),
          label: "Recovery Stopped",
          detail: reason?.trim() ? reason.trim() : "Recovery stopped manually.",
          kind: "human" as const,
        },
      ],
    }),
    [
      addAudit({
        caseId: id,
        event: "Recovery Stopped",
        decision: "Manual stop",
        action: "Disable further attempts",
        result: "No further contact",
        actor: "Human",
      }),
    ],
  );
}

export async function refreshData() {
  await delay(600);
  listeners.forEach((l) => l());
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
