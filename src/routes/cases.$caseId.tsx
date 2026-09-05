import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Ban,
  Bot,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  Play,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, ProbabilityBar, StatusBadge, formatINR } from "@/components/bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  analyzeCase,
  escalateCase,
  evaluateGuardrails,
  executeRecovery,
  generatePaymentLink,
  markRecovered,
  stopRecovery,
} from "@/lib/api";
import { formatDateTime, useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cases/$caseId")({
  head: ({ params }) => ({
    meta: [
      { title: `Case ${params.caseId} — RecoverAI` },
      {
        name: "description",
        content:
          "AI decision, reasoning, guardrails, recovery timeline and audit history for a single revenue recovery case.",
      },
      { property: "og:title", content: `Case ${params.caseId} — RecoverAI` },
      {
        property: "og:description",
        content: "Understand, decide, recover and verify a failed payment.",
      },
    ],
  }),
  component: CaseDetail,
});

type Pending = null | "analyze" | "execute" | "link" | "escalate" | "stop" | "recovered";

function CaseDetail() {
  const { caseId } = Route.useParams();
  const state = useAppState();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Pending>(null);
  const [confirm, setConfirm] = useState<Pending>(null);

  const c = state.cases.find((x) => x.id === caseId);
  const customer = state.customers.find((x) => x.id === c?.customerId);
  const audit = state.audit.filter((a) => a.caseId === caseId);

  if (!c) {
    return (
      <AppShell title="Case not found">
        <Button asChild variant="outline">
          <Link to="/cases">
            <ArrowLeft className="size-4" /> Back to cases
          </Link>
        </Button>
      </AppShell>
    );
  }

  const guard = evaluateGuardrails(c, state.settings);
  const analyzed = c.aiDecision !== "Pending Analysis";

  async function run(kind: Exclude<Pending, null>) {
    setPending(kind);
    try {
      if (kind === "analyze") {
        const r = await analyzeCase(caseId);
        toast.success("AI analysis complete", {
          description: `${r.aiDecision} · Recommended: ${r.recommendedAction}`,
        });
      } else if (kind === "link") {
        const r = await generatePaymentLink(caseId);
        toast.success("Payment link generated", { description: r.paymentLink });
      } else if (kind === "execute") {
        const r = await executeRecovery(caseId);
        if (r.status === "Stopped") {
          toast.warning("Attempt limit reached", {
            description: "Automatic recovery has been switched off for this case.",
          });
        } else {
          toast.success("Recovery executed", { description: r.recommendedAction });
        }
      } else if (kind === "escalate") {
        await escalateCase(caseId);
        toast.success("Escalated for human review");
      } else if (kind === "stop") {
        await stopRecovery(caseId);
        toast.warning("Recovery stopped for this case");
      } else if (kind === "recovered") {
        const r = await markRecovered(caseId);
        toast.success("Payment recovered", {
          description: `${formatINR(r.amount)} added to recovered revenue.`,
        });
      }
    } catch (err) {
      toast.error("Action blocked", {
        description: err instanceof Error ? err.message : "Guardrail prevented this action.",
      });
    } finally {
      setPending(null);
      setConfirm(null);
    }
  }

  const confirmCopy: Record<string, { title: string; body: string }> = {
    execute: {
      title: "Execute recovery action?",
      body: `RecoverAI will run “${c.recommendedAction}” for ${c.customerName} and use one recovery attempt.`,
    },
    escalate: {
      title: "Escalate to human review?",
      body: "Automatic recovery pauses and the revenue operations team takes over this case.",
    },
    stop: {
      title: "Stop recovery?",
      body: "No further attempts or customer contact will happen for this case.",
    },
    recovered: {
      title: "Mark payment as recovered?",
      body: `${formatINR(c.amount)} will be verified and added to recovered revenue.`,
    },
  };

  return (
    <AppShell
      title={`Case ${c.id}`}
      subtitle={`${c.customerName} · ${c.transactionId} · ${c.problem}`}
      actions={
        <Button asChild variant="outline">
          <Link to="/cases">
            <ArrowLeft className="size-4" /> All cases
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardDescription>Amount at risk</CardDescription>
                  <p className="tabular text-4xl font-bold tracking-tight">{formatINR(c.amount)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={c.priority} />
                  <StatusBadge status={c.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Customer" value={c.customerName} sub={customer?.email} />
              <Field label="Transaction" value={c.transactionId} sub={c.method} />
              <Field label="Failure reason" value={c.failureReason} />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Recovery probability
                </p>
                <div className="mt-2">
                  <ProbabilityBar value={c.probability} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="size-4 text-primary" /> AI Decision
              </CardTitle>
              <CardDescription>Plain-language reasoning behind the recommendation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold",
                    c.aiDecision === "Auto Recovery Approved" && "bg-success-soft text-success",
                    c.aiDecision === "Human Review Required" &&
                      "bg-warning-soft text-warning-foreground",
                    c.aiDecision === "Recovery Blocked" && "bg-destructive-soft text-destructive",
                    c.aiDecision === "Pending Analysis" && "bg-muted text-muted-foreground",
                  )}
                >
                  <Sparkles className="size-4" />
                  {c.aiDecision}
                </span>
                <span className="text-sm text-muted-foreground">
                  Recommended action:{" "}
                  <span className="font-medium text-foreground">{c.recommendedAction}</span>
                </span>
              </div>

              {analyzed ? (
                <ul className="space-y-2">
                  {c.aiReasoning.map((r) => (
                    <li key={r} className="flex gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  This case has not been analysed yet. Run <strong>Analyze Case</strong> to get the
                  AI decision, reasoning and safe next action.
                </p>
              )}

              {c.paymentLink && (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-info-soft px-3 py-2 text-sm">
                  <Link2 className="size-4 text-info" />
                  <span className="truncate font-mono text-xs">{c.paymentLink}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => {
                      navigator.clipboard?.writeText(c.paymentLink!);
                      toast.success("Payment link copied");
                    }}
                  >
                    <Copy className="size-3.5" /> Copy
                  </Button>
                </div>
              )}

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => run("analyze")} disabled={pending !== null}>
                  {pending === "analyze" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Analyze Case
                </Button>
                <Button
                  variant="outline"
                  disabled={pending !== null || guard.recoveryDisabled || !analyzed}
                  onClick={() => setConfirm("execute")}
                >
                  <Play className="size-4" /> Execute Recovery
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    pending !== null ||
                    c.status === "Recovered" ||
                    c.status === "Stopped" ||
                    guard.contactLimitReached
                  }
                  onClick={() => run("link")}
                >
                  {pending === "link" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                  Generate Payment Link
                </Button>
                <Button
                  variant="outline"
                  disabled={pending !== null || c.status === "Escalated" || c.status === "Recovered"}
                  onClick={() => setConfirm("escalate")}
                >
                  <ShieldAlert className="size-4" /> Escalate
                </Button>
                <Button
                  variant="outline"
                  disabled={pending !== null || c.status === "Stopped" || c.status === "Recovered"}
                  onClick={() => setConfirm("stop")}
                >
                  <Ban className="size-4" /> Stop Recovery
                </Button>
                {c.status !== "Recovered" && (
                  <Button
                    variant="default"
                    className="bg-success text-success-foreground hover:bg-success/90"
                    disabled={pending !== null || c.status === "Stopped"}
                    onClick={() => setConfirm("recovered")}
                  >
                    <CheckCircle2 className="size-4" /> Mark as Recovered
                  </Button>
                )}
              </div>

              {guard.recoveryDisabled && (
                <div className="flex gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning-foreground">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Automatic recovery is disabled</p>
                    <ul className="mt-1 list-inside list-disc">
                      {guard.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Recovery Timeline</CardTitle>
              <CardDescription>Detect → Understand → Decide → Recover → Verify</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l border-border pl-6">
                {c.timeline.map((t, i) => (
                  <li key={`${t.at}-${i}`}>
                    <span
                      className={cn(
                        "absolute -left-[7px] mt-1.5 size-3.5 rounded-full border-2 border-background",
                        t.kind === "ai" && "bg-primary",
                        t.kind === "system" && "bg-muted-foreground",
                        t.kind === "human" && "bg-warning",
                      )}
                    />
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-sm text-muted-foreground">{t.detail}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {t.kind} · {formatDateTime(t.at)}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Audit History</CardTitle>
              <CardDescription>Immutable record of every decision and action</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-y border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">Timestamp</th>
                    <th className="px-6 py-3 font-medium">Event</th>
                    <th className="px-6 py-3 font-medium">Decision</th>
                    <th className="px-6 py-3 font-medium">Action</th>
                    <th className="px-6 py-3 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                        No audit entries yet for this case.
                      </td>
                    </tr>
                  )}
                  {audit.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="tabular px-6 py-3 text-muted-foreground">
                        {formatDateTime(a.timestamp)}
                      </td>
                      <td className="px-6 py-3 font-medium">{a.event}</td>
                      <td className="px-6 py-3 text-muted-foreground">{a.decision}</td>
                      <td className="px-6 py-3 text-muted-foreground">{a.action}</td>
                      <td className="px-6 py-3">{a.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Recovery Guardrails
              </CardTitle>
              <CardDescription>Safety limits applied before any action</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Guard
                label="Recovery attempts"
                value={`${guard.attemptsUsed} / ${guard.maxAttempts}`}
                breached={guard.attemptLimitReached}
              >
                <Progress value={(guard.attemptsUsed / guard.maxAttempts) * 100} className="h-1.5" />
              </Guard>
              <Guard
                label="Customer contacts"
                value={`${guard.contactsUsed} / ${guard.maxContacts}`}
                breached={guard.contactLimitReached}
              >
                <Progress value={(guard.contactsUsed / guard.maxContacts) * 100} className="h-1.5" />
              </Guard>
              <Guard
                label="Recovery window"
                value={`${guard.hoursElapsed.toFixed(1)}h / ${guard.windowHours}h`}
                breached={guard.windowExpired}
              />
              <Guard
                label="High-value threshold"
                value={formatINR(guard.highValueThreshold)}
                breached={guard.highValue}
              />
              <Guard
                label="Human approval above threshold"
                value={guard.needsApproval ? "Required" : "Not required"}
                breached={guard.needsApproval}
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Recovery Attempts</CardTitle>
              <CardDescription>What has been tried so far</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Array.from({ length: state.settings.maxAttempts }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2",
                    i < c.attempts
                      ? "border-primary/30 bg-info-soft text-info"
                      : "border-dashed border-border text-muted-foreground",
                  )}
                >
                  <span>Attempt {i + 1}</span>
                  <span className="text-xs font-medium">{i < c.attempts ? "Used" : "Available"}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {customer && (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Customer</CardTitle>
                <CardDescription>{customer.segment} · {customer.city}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Email" value={customer.email} />
                <Row label="Phone" value={customer.phone} />
                <Row label="Lifetime value" value={formatINR(customer.lifetimeValue)} />
                <Row label="Payments" value={String(customer.totalPayments)} />
                <Row label="Failed payments" value={String(customer.failedPayments)} />
                <Row label="Recovered revenue" value={formatINR(customer.recoveredRevenue)} />
                <Button
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => navigate({ to: "/customers" })}
                >
                  View customer history
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm ? confirmCopy[confirm]?.title : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? confirmCopy[confirm]?.body : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && run(confirm)}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null} Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}

function Guard({
  label,
  value,
  breached,
  children,
}: {
  label: string;
  value: string;
  breached: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-semibold", breached ? "text-destructive" : "text-foreground")}>
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}
