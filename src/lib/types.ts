export type Problem = "Payment Failed" | "Checkout Abandoned" | "Repeated Failure";

export type Priority = "Critical" | "High" | "Medium" | "Low";

export type CaseStatus =
  | "Detected"
  | "Analyzed"
  | "Recovery Initiated"
  | "Recovered"
  | "Escalated"
  | "Stopped";

export type AIDecision =
  | "Pending Analysis"
  | "Auto Recovery Approved"
  | "Human Review Required"
  | "Recovery Blocked";

export type RecoveryAction =
  | "Send Smart Payment Link"
  | "Retry Payment on Backup Method"
  | "Send Checkout Reminder"
  | "Escalate to Human Review"
  | "Stop Recovery";

export type TransactionStatus = "Success" | "Failed" | "Abandoned" | "Recovered";

export interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: string;
  date: string;
  status: TransactionStatus;
  failureReason: string | null;
  recoveryStatus: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  segment: "Enterprise" | "SMB" | "Retail";
  lifetimeValue: number;
  totalPayments: number;
  failedPayments: number;
  recoveredRevenue: number;
}

export interface TimelineEvent {
  at: string;
  label: string;
  detail: string;
  kind: "system" | "ai" | "human";
}

export interface RecoveryCase {
  id: string;
  customerId: string;
  customerName: string;
  transactionId: string;
  amount: number;
  problem: Problem;
  failureReason: string;
  probability: number;
  priority: Priority;
  status: CaseStatus;
  attempts: number;
  contacts: number;
  createdAt: string;
  method: string;
  aiDecision: AIDecision;
  aiReasoning: string[];
  recommendedAction: RecoveryAction;
  paymentLink?: string;
  timeline: TimelineEvent[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  caseId: string;
  event: string;
  decision: string;
  action: string;
  result: string;
  actor: "System" | "AI Agent" | "Human";
}

export interface Settings {
  maxAttempts: number;
  maxContacts: number;
  recoveryWindowHours: number;
  highValueThreshold: number;
  aiConfidenceThreshold: number;
  notifyEmail: boolean;
  notifySlack: boolean;
  autoRecovery: boolean;
}
