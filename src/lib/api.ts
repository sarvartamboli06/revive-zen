/**
 * Centralised API service for RecoverAI.
 *
 * Every read/write goes through the FastAPI backend (default http://localhost:8000,
 * override with VITE_API_BASE_URL):
 *
 *   GET  /api/dashboard
 *   GET  /api/transactions
 *   GET  /api/customers
 *   GET  /api/recovery-cases
 *   GET  /api/recovery-cases/{case_id}
 *   POST /api/recovery-cases/{case_id}/analyze
 *   POST /api/recovery-cases/{case_id}/execute
 *   POST /api/recovery-cases/{case_id}/payment-link
 *   POST /api/recovery-cases/{case_id}/mark-recovered
 *   POST /api/recovery-cases/{case_id}/escalate
 *   POST /api/recovery-cases/{case_id}/stop
 *   GET  /api/audit
 *   GET  /api/audit/{case_id}
 *
 * Components never call fetch directly — they read the store below.
 */
import { defaultSettings } from "@/data/mock";
import { api, ApiError } from "@/lib/http";
import type {
  AuditEntry,
  Customer,
  RecoveryCase,
  Settings,
  Transaction,
} from "@/lib/types";

export { ApiError, API_BASE_URL } from "@/lib/http";

export interface AppState {
  cases: RecoveryCase[];
  transactions: Transaction[];
  customers: Customer[];
  audit: AuditEntry[];
  settings: Settings;
  authenticated: boolean;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

let state: AppState = {
  cases: [],
  transactions: [],
  customers: [],
  audit: [],
  settings: { ...defaultSettings },
  authenticated: false,
  loading: false,
  loaded: false,
  error: null,
};

const listeners = new Set<() => void>();

function commit(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/* ------------------------------------------------------------------ */
/* Payload normalisation                                               */
/* ------------------------------------------------------------------ */

/** Backends return either a bare list or { items: [...] } / { data: [...] }. */
function toList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    for (const key of ["items", "data", "results", "cases", "transactions", "customers", "audit"]) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

function normalizeCase(raw: Record<string, unknown>): RecoveryCase {
  const c = raw as unknown as RecoveryCase & Record<string, unknown>;
  return {
    ...c,
    id: String(c.id ?? (raw['caseId'] as string) ?? ""),
    amount: Number(c.amount ?? 0),
    probability: Number(c.probability ?? 0),
    attempts: Number(c.attempts ?? 0),
    contacts: Number(c.contacts ?? 0),
    aiReasoning: Array.isArray(c.aiReasoning)
      ? c.aiReasoning
      : typeof c.aiReasoning === "string"
        ? [c.aiReasoning]
        : [],
    timeline: Array.isArray(c.timeline) ? c.timeline : [],
    createdAt: c.createdAt ?? new Date().toISOString(),
  };
}

/** Actions may return the case itself, or { case: {...} } / { data: {...} }. */
function extractCase(payload: unknown): RecoveryCase | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const inner = (obj['case'] ?? obj['recoveryCase'] ?? obj['data'] ?? obj) as Record<string, unknown>;
  if (!inner || typeof inner !== "object" || !("id" in inner || "amount" in inner)) return null;
  return normalizeCase(inner);
}

function mergeCase(updated: RecoveryCase) {
  const exists = state.cases.some((c) => c.id === updated.id);
  commit({
    cases: exists
      ? state.cases.map((c) => (c.id === updated.id ? updated : c))
      : [updated, ...state.cases],
  });
  return updated;
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

let dashboard: DashboardMetrics | null = null;

function computeDashboard(): DashboardMetrics {
  const { cases } = state;
  const recoveredCases = cases.filter((c) => c.status === "Recovered");
  const atRiskCases = cases.filter((c) => c.status !== "Recovered" && c.status !== "Stopped");
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

/** Backend numbers win; anything the API omits is derived from the case list. */
export function getDashboard(): DashboardMetrics {
  const derived = computeDashboard();
  if (!dashboard) return derived;
  const pick = (value: number | undefined, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return {
    revenueAtRisk: pick(dashboard.revenueAtRisk, derived.revenueAtRisk),
    revenueRecovered: pick(dashboard.revenueRecovered, derived.revenueRecovered),
    recoveryRate: pick(dashboard.recoveryRate, derived.recoveryRate),
    activeCases: pick(dashboard.activeCases, derived.activeCases),
    customersRecovered: pick(dashboard.customersRecovered, derived.customersRecovered),
    escalatedCases: pick(dashboard.escalatedCases, derived.escalatedCases),
  };
}

export const getTransactions = () => state.transactions;
export const getRecoveryCases = () => state.cases;
export const getCase = (id: string) => state.cases.find((c) => c.id === id);
export const getCustomers = () => state.customers;
export const getAudit = () => state.audit;
export const getSettings = () => state.settings;

/* ------------------------------------------------------------------ */
/* Charts derived from live backend data                               */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${MONTHS[d.getMonth()]}`;
}

function performanceSeries() {
  const buckets = new Map<string, { month: string; atRisk: number; recovered: number }>();
  for (const c of state.cases) {
    const month = monthKey(c.createdAt);
    const row = buckets.get(month) ?? { month, atRisk: 0, recovered: 0 };
    if (c.status === "Recovered") row.recovered += c.amount;
    else if (c.status !== "Stopped") row.atRisk += c.amount;
    buckets.set(month, row);
  }
  return [...buckets.values()].sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
}

function recoveryRateSeries() {
  return performanceSeries().map((row) => {
    const total = row.atRisk + row.recovered;
    return { month: row.month, rate: total ? Math.round((row.recovered / total) * 1000) / 10 : 0 };
  });
}

function failureReasonSeries() {
  const buckets = new Map<string, { reason: string; recovered: number; lost: number }>();
  for (const c of state.cases) {
    const reason = c.failureReason || "Unknown";
    const row = buckets.get(reason) ?? { reason, recovered: 0, lost: 0 };
    if (c.status === "Recovered") row.recovered += c.amount;
    else row.lost += c.amount;
    buckets.set(reason, row);
  }
  return [...buckets.values()].sort((a, b) => b.recovered + b.lost - (a.recovered + a.lost));
}

function methodSeries() {
  const buckets = new Map<string, number>();
  for (const t of state.transactions) {
    buckets.set(t.method, (buckets.get(t.method) ?? 0) + 1);
  }
  const total = [...buckets.values()].reduce((s, v) => s + v, 0);
  if (!total) return [];
  return [...buckets.entries()]
    .map(([name, count]) => ({ name, value: Math.round((count / total) * 100) }))
    .sort((a, b) => b.value - a.value);
}

export const charts = {
  get performanceSeries() {
    return performanceSeries();
  },
  get recoveryRateSeries() {
    return recoveryRateSeries();
  },
  get failureReasonSeries() {
    return failureReasonSeries();
  },
  get methodSeries() {
    return methodSeries();
  },
};

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

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

async function safe<T>(promise: Promise<T>, fallback: T, errors: string[]): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    errors.push(errorMessage(error));
    return fallback;
  }
}

/** Fetch everything the app needs. Called on mount and by the refresh button. */
export async function loadAll() {
  commit({ loading: true, error: null });
  const errors: string[] = [];
  const [dash, cases, transactions, customers, audit] = await Promise.all([
    safe(api.get<DashboardMetrics>("/api/dashboard"), null as DashboardMetrics | null, errors),
    safe(api.get<unknown>("/api/recovery-cases"), null, errors),
    safe(api.get<unknown>("/api/transactions"), null, errors),
    safe(api.get<unknown>("/api/customers"), null, errors),
    safe(api.get<unknown>("/api/audit"), null, errors),
  ]);

  dashboard = dash ?? dashboard;
  commit({
    ...(cases ? { cases: toList<Record<string, unknown>>(cases).map(normalizeCase) } : {}),
    ...(transactions ? { transactions: toList<Transaction>(transactions) } : {}),
    ...(customers ? { customers: toList<Customer>(customers) } : {}),
    ...(audit ? { audit: toList<AuditEntry>(audit) } : {}),
    loading: false,
    loaded: true,
    error: errors[0] ?? null,
  });
  if (errors.length) throw new ApiError(errors[0]!, 0);
}

/** GET /api/recovery-cases/{case_id} plus its audit history. */
export async function loadCase(id: string) {
  const [detail, audit] = await Promise.all([
    api.get<unknown>(`/api/recovery-cases/${encodeURIComponent(id)}`),
    api
      .get<unknown>(`/api/audit/${encodeURIComponent(id)}`)
      .catch(() => null),
  ]);
  const updated = extractCase(detail);
  if (updated) mergeCase(updated);
  if (audit) {
    const rows = toList<AuditEntry>(audit);
    const others = state.audit.filter((a) => a.caseId !== id);
    commit({ audit: [...rows, ...others] });
  }
  return updated;
}

export async function refreshData() {
  await loadAll();
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

async function caseAction(id: string, path: string, body?: unknown) {
  const payload = await api.post<unknown>(
    `/api/recovery-cases/${encodeURIComponent(id)}/${path}`,
    body,
  );
  const updated = extractCase(payload);
  if (updated) mergeCase(updated);
  // Keep dashboard totals and audit trail in sync after any state change.
  void syncAfterAction(id);
  return updated ?? getCase(id)!;
}

async function syncAfterAction(id: string) {
  try {
    const [dash, audit] = await Promise.all([
      api.get<DashboardMetrics>("/api/dashboard").catch(() => null),
      api.get<unknown>("/api/audit").catch(() => null),
    ]);
    if (dash) dashboard = dash;
    if (audit) commit({ audit: toList<AuditEntry>(audit) });
    else commit({});
    await loadCase(id).catch(() => null);
  } catch {
    /* non-fatal background sync */
  }
}

export const analyzeCase = (id: string) => caseAction(id, "analyze");
export const executeRecovery = (id: string) => caseAction(id, "execute");
export const generatePaymentLink = (id: string) => caseAction(id, "payment-link");
export const markRecovered = (id: string) => caseAction(id, "mark-recovered");
export const escalateCase = (id: string, note?: string) =>
  caseAction(id, "escalate", note?.trim() ? { note: note.trim() } : undefined);
export const stopRecovery = (id: string, reason?: string) =>
  caseAction(id, "stop", reason?.trim() ? { reason: reason.trim() } : undefined);

/* ------------------------------------------------------------------ */
/* Local-only preferences                                              */
/* ------------------------------------------------------------------ */

export function login() {
  commit({ authenticated: true });
}

export function logout() {
  commit({ authenticated: false });
}

export function updateSettings(patch: Partial<Settings>) {
  commit({ settings: { ...state.settings, ...patch } });
}

if (typeof window !== "undefined") {
  setInterval(() => {
    void loadAll().catch(() => {});
  }, 3000);
  window.addEventListener("focus", () => {
    void loadAll().catch(() => {});
  });
}

