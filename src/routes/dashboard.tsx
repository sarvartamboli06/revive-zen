import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeIndianRupee,
  Bot,
  Gauge,
  LifeBuoy,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/app-shell";
import { MetricCard, ProbabilityBar, StatusBadge, formatINR } from "@/components/bits";
import { charts, getDashboard } from "@/lib/api";
import { formatCompactINR, formatDateTime, useAppState } from "@/lib/store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Recovery Dashboard — RecoverAI" },
      {
        name: "description",
        content:
          "Track revenue at risk, recovered revenue, recovery rate and live AI recovery activity across failed payments.",
      },
      { property: "og:title", content: "Recovery Dashboard — RecoverAI" },
      {
        property: "og:description",
        content: "Live view of revenue at risk and revenue recovered by AI.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const state = useAppState();
  const navigate = useNavigate();
  const m = getDashboard();

  const activity = [...state.audit]
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
    .slice(0, 7);

  const topCases = [...state.cases]
    .filter((c) => c.status !== "Recovered" && c.status !== "Stopped")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <AppShell
      title="Recovery Dashboard"
      subtitle="Detect → Understand → Decide → Recover → Verify → Audit"
      actions={
        <>
          <Button variant="outline" onClick={() => navigate({ to: "/revenue-at-risk" })}>
            View revenue at risk
          </Button>
          <Button onClick={() => navigate({ to: "/cases" })}>
            Open recovery cases
            <ArrowUpRight className="size-4" />
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Revenue at Risk"
          value={formatINR(m.revenueAtRisk)}
          hint={`${m.activeCases} open cases`}
          tone="danger"
          icon={<AlertTriangle className="size-5" />}
        />
        <MetricCard
          label="Revenue Recovered"
          value={formatINR(m.revenueRecovered)}
          hint="Verified collections"
          tone="success"
          icon={<BadgeIndianRupee className="size-5" />}
        />
        <MetricCard
          label="Recovery Rate"
          value={`${m.recoveryRate}%`}
          hint="Recovered vs detected"
          tone="info"
          icon={<Gauge className="size-5" />}
        />
        <MetricCard
          label="Active Cases"
          value={String(m.activeCases)}
          hint="Being worked by the AI agent"
          icon={<LifeBuoy className="size-5" />}
        />
        <MetricCard
          label="Customers Recovered"
          value={String(m.customersRecovered)}
          hint="Paid after a failure"
          tone="success"
          icon={<Users className="size-5" />}
        />
        <MetricCard
          label="Escalated Cases"
          value={String(m.escalatedCases)}
          hint="Waiting for human approval"
          tone="warning"
          icon={<ShieldAlert className="size-5" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Recovery Performance</CardTitle>
            <CardDescription>Detected at-risk revenue vs recovered revenue by month</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.performanceSeries}>
                <defs>
                  <linearGradient id="risk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <Tooltip
                  formatter={(v: number, n: string) => [
                    formatINR(v),
                    n === "atRisk" ? "At risk" : "Recovered",
                  ]}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
                />
                <Legend
                  formatter={(v) => (v === "atRisk" ? "Revenue at risk" : "Revenue recovered")}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="atRisk"
                  stroke="var(--destructive)"
                  fill="url(#risk)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="recovered"
                  stroke="var(--success)"
                  fill="url(#rec)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-primary" /> Recent AI Recovery Activity
            </CardTitle>
            <CardDescription>Every action the agent has taken</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activity.map((a) => (
              <Link
                key={a.id}
                to="/cases/$caseId"
                params={{ caseId: a.caseId }}
                className="block border-l-2 border-border pl-3 transition-colors hover:border-primary"
              >
                <p className="text-sm font-medium">{a.event}</p>
                <p className="text-xs text-muted-foreground">
                  {a.caseId} · {a.result}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {a.actor} · {formatDateTime(a.timestamp)}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-card">
        <CardHeader>
          <CardTitle>Highest value cases open now</CardTitle>
          <CardDescription>Ranked by revenue at risk</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-y border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Case</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Problem</th>
                <th className="px-6 py-3 font-medium">Probability</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {topCases.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-6 py-3">
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: c.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.id}
                    </Link>
                  </td>
                  <td className="px-6 py-3">{c.customerName}</td>
                  <td className="tabular px-6 py-3 font-semibold">{formatCompactINR(c.amount)}</td>
                  <td className="px-6 py-3 text-muted-foreground">{c.problem}</td>
                  <td className="px-6 py-3">
                    <ProbabilityBar value={c.probability} />
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
