import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge, formatINR } from "@/components/bits";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime, useAppState } from "@/lib/store";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customers — RecoverAI" },
      {
        name: "description",
        content:
          "Customer payment history, failed payments, open recovery cases and revenue recovered for each account.",
      },
      { property: "og:title", content: "Customers — RecoverAI" },
      {
        property: "og:description",
        content: "See which customers are losing you revenue, and how much you got back.",
      },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { customers, transactions, cases } = useAppState();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(customers[0]?.id ?? "");

  const list = customers.filter(
    (c) =>
      !q.trim() ||
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.email.toLowerCase().includes(q.toLowerCase()),
  );
  const active = customers.find((c) => c.id === selected) ?? list[0];
  const history = transactions.filter((t) => t.customerId === active?.id);
  const custCases = cases.filter((c) => c.customerId === active?.id);

  return (
    <AppShell title="Customers" subtitle="Payment history, failures and recovered revenue">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-1">
          <CardHeader className="pb-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search customers"
            />
          </CardHeader>
          <CardContent className="max-h-[640px] space-y-1 overflow-y-auto p-2">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                  active?.id === c.id ? "bg-info-soft" : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {c.segment}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.failedPayments} failed · {formatINR(c.recoveredRevenue)} recovered
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        {active && (
          <div className="space-y-4 lg:col-span-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>{active.name}</CardTitle>
                <CardDescription className="flex flex-wrap gap-x-4">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3.5" /> {active.email}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5" /> {active.phone}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-4">
                <Stat label="Lifetime value" value={formatINR(active.lifetimeValue)} />
                <Stat label="Payments" value={String(active.totalPayments)} />
                <Stat label="Failed payments" value={String(active.failedPayments)} />
                <Stat label="Recovered revenue" value={formatINR(active.recoveredRevenue)} />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Recovery cases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {custCases.length === 0 && (
                  <p className="text-sm text-muted-foreground">No recovery cases.</p>
                )}
                {custCases.map((c) => (
                  <Link
                    key={c.id}
                    to="/cases/$caseId"
                    params={{ caseId: c.id }}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="font-medium">{c.id}</span>
                    <span className="text-muted-foreground">{c.problem}</span>
                    <span className="tabular font-semibold">{formatINR(c.amount)}</span>
                    <StatusBadge status={c.status} />
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Payment history</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-y border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-medium">Transaction</th>
                      <th className="px-6 py-3 font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Method</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0">
                        <td className="tabular px-6 py-3">{t.id}</td>
                        <td className="tabular px-6 py-3 font-semibold">{formatINR(t.amount)}</td>
                        <td className="px-6 py-3 text-muted-foreground">{t.method}</td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {formatDateTime(t.date)}
                        </td>
                        <td className="px-6 py-3">
                          <StatusBadge status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
