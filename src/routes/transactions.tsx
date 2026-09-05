import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyRow, StatusBadge, formatINR } from "@/components/bits";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime, useAppState } from "@/lib/store";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — RecoverAI" },
      {
        name: "description",
        content:
          "All payments with status, failure reason and recovery status, so no lost rupee goes unnoticed.",
      },
      { property: "og:title", content: "Transactions — RecoverAI" },
      {
        property: "og:description",
        content: "Search payments by customer, method and recovery status.",
      },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const { transactions } = useAppState();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");

  const methods = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.method))),
    [transactions],
  );

  const rows = transactions.filter((t) => {
    const term = q.trim().toLowerCase();
    return (
      (!term ||
        t.id.toLowerCase().includes(term) ||
        t.customerName.toLowerCase().includes(term)) &&
      (status === "all" || t.status === status) &&
      (method === "all" || t.method === method)
    );
  });

  return (
    <AppShell title="Transactions" subtitle={`${rows.length} payments in view`}>
      <Card className="shadow-card">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search transaction or customer"
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["Success", "Failed", "Abandoned", "Recovered"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment methods</SelectItem>
                {methods.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Transaction ID</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Payment Method</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Failure Reason</th>
                  <th className="px-4 py-3 font-medium">Recovery Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <EmptyRow colSpan={8} message="No transactions match." />}
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="tabular px-4 py-3 font-medium">{t.id}</td>
                    <td className="px-4 py-3">{t.customerName}</td>
                    <td className="tabular px-4 py-3 font-semibold">{formatINR(t.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.method}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(t.date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.failureReason ?? "—"}</td>
                    <td className="px-4 py-3">{t.recoveryStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
