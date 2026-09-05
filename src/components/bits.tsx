import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CaseStatus, Priority, TransactionStatus } from "@/lib/types";

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const statusStyles: Record<string, string> = {
  Detected: "bg-warning-soft text-warning-foreground border-warning/30",
  Analyzed: "bg-info-soft text-info border-info/30",
  "Recovery Initiated": "bg-info-soft text-info border-info/30",
  Recovered: "bg-success-soft text-success border-success/30",
  Escalated: "bg-destructive-soft text-destructive border-destructive/30",
  Stopped: "bg-muted text-muted-foreground border-border",
  Success: "bg-success-soft text-success border-success/30",
  Failed: "bg-destructive-soft text-destructive border-destructive/30",
  Abandoned: "bg-warning-soft text-warning-foreground border-warning/30",
};

export function StatusBadge({ status }: { status: CaseStatus | TransactionStatus | string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        statusStyles[status] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {status}
    </span>
  );
}

const priorityStyles: Record<Priority, string> = {
  Critical: "bg-destructive text-primary-foreground",
  High: "bg-warning text-warning-foreground",
  Medium: "bg-info-soft text-info",
  Low: "bg-muted text-muted-foreground",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        priorityStyles[priority],
      )}
    >
      {priority}
    </span>
  );
}

export function ProbabilityBar({ value }: { value: number }) {
  const tone =
    value >= 70 ? "bg-success" : value >= 45 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex min-w-28 items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="tabular text-xs font-semibold">{value}%</span>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    default: "bg-muted text-foreground",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning-foreground",
    danger: "bg-destructive-soft text-destructive",
    info: "bg-info-soft text-info",
  } as const;
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-start gap-4 p-5">
        <div className={cn("flex size-10 items-center justify-center rounded-lg", tones[tone])}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="tabular mt-1 truncate text-2xl font-bold tracking-tight">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

export function SectionBadge({ children }: { children: ReactNode }) {
  return (
    <Badge variant="secondary" className="rounded-md font-medium">
      {children}
    </Badge>
  );
}
