/**
 * RecoverAI Centralized Frontend API Service.
 * Connects frontend to the FastAPI backend at http://localhost:8000.
 */

import type {
  AuditEntry,
  Customer,
  RecoveryCase,
  Transaction,
} from "@/lib/types";

const API_BASE_URL =
  (typeof process !== "undefined" && process.env?.["VITE_API_URL"]) ||
  (typeof import.meta !== "undefined" && (import.meta as any).env?.["VITE_API_URL"]) ||
  "http://localhost:8000";

export interface BackendDashboardMetrics {
  revenue_at_risk: number;
  revenue_recovered: number;
  recovery_rate: number;
  active_cases: number;
  customers_recovered: number;
  escalated_cases: number;
  revenueAtRisk?: number;
  revenueRecovered?: number;
  recoveryRate?: number;
  activeCases?: number;
  customersRecovered?: number;
  escalatedCases?: number;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${response.status}`);
    }
    return await response.json();
  } catch (error: any) {
    console.warn(`[API] Request to ${endpoint} failed:`, error.message);
    throw error;
  }
}

// ----------------------------------------------------------------------
// Centralized API Methods
// ----------------------------------------------------------------------
export const apiClient = {
  // Health
  getHealth: () => request<{ status: string; service: string; ai_agent: string }>("/health"),

  // Dashboard
  getDashboard: () => request<BackendDashboardMetrics>("/api/dashboard"),

  // Transactions
  getTransactions: () => request<any[]>("/api/transactions"),
  getTransaction: (id: string) => request<any>(`/api/transactions/${id}`),

  // Customers
  getCustomers: () => request<any[]>("/api/customers"),
  getCustomer: (id: string) => request<any>(`/api/customers/${id}`),

  // Recovery Cases
  getRecoveryCases: () => request<any[]>("/api/recovery-cases"),
  getRecoveryCase: (caseId: string) => request<any>(`/api/recovery-cases/${caseId}`),

  // Recovery Actions
  analyzeCase: (caseId: string) =>
    request<any>(`/api/recovery-cases/${caseId}/analyze`, { method: "POST" }),

  executeRecovery: (caseId: string, action?: string) =>
    request<any>(`/api/recovery-cases/${caseId}/execute`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),

  generatePaymentLink: (caseId: string) =>
    request<any>(`/api/recovery-cases/${caseId}/payment-link`, { method: "POST" }),

  markRecovered: (caseId: string) =>
    request<any>(`/api/recovery-cases/${caseId}/mark-recovered`, { method: "POST" }),

  escalateCase: (caseId: string, note?: string) =>
    request<any>(`/api/recovery-cases/${caseId}/escalate`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),

  stopRecovery: (caseId: string, reason?: string) =>
    request<any>(`/api/recovery-cases/${caseId}/stop`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Audit Logs
  getAuditLogs: () => request<any[]>("/api/audit"),
  getCaseAuditLogs: (caseId: string) => request<any[]>(`/api/audit/${caseId}`),
};
