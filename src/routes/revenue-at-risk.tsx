import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  EmptyRow,
  PriorityBadge,
  ProbabilityBar,
  StatusBadge,
  formatINR,
} from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/revenue-at-risk")({
  head: () => ({
    meta: [
      { title: "Revenue at Risk — RecoverAI" },
      {
        name: "description",
        content:
          "Every failed payment, abandoned checkout and repeated failure with recovery probability and the AI recommended action.",
      },
      { property: "og:title", content: "Revenue at Risk — RecoverAI" },
      {
        property: "og:description",
        content: "Search and filter at-risk revenue by problem, priority and status.",
      },
    ],
  }),
  component: RiskPage,
});

function RiskPage() {
  const { cases } = useAppState();
  const [q, setQ] = useState("");
  const [problem, setProblem] = useState("all");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = useMemo(
    () =>
      cases.filter((c) => {
        const term = q.trim().toLowerCase();
        const matches =
          !term ||
          c.customerName.toLowerCase().includes(term) ||
          c.id.toLowerCase().includes(term) ||
          c.transactionId.toLowerCase().includes(term);
        return (
          matches &&
          (problem === "all" || c.problem === problem) &&
          (priority === "all" || c.priority === priority) &&
          (status === "all" || c.status === status)
        );
      }),
    [cases, q, problem, priority, status],
  );

  const total = rows
    .filter((c) => c.status !== "Recovered" && c.status !== "Stopped")
    .reduce((s, c) => s + c.amount, 0);

  return (
    <AppShell
      title="Revenue at Risk"
      subtitle={`${rows.length} cases in view · ${formatINR(total)} still recoverable`}
    >
      <Card className="shadow-card">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search customer, case or transaction"
                className="pl-9"
              />
            </div>
            <FilterSelect
              value={problem}
              onChange={setProblem}
              label="Problem"
              options={["Payment Failed", "Checkout Abandoned", "Repeated Failure"]}
            />
            <FilterSelect
              value={priority}
              onChange={setPriority}
              label="Priority"
              options={["Critical", "High", "Medium", "Low"]}
            />
            <FilterSelect
              value={status}
              onChange={setStatus}
              label="Status"
              options={[
                "Detected",
                "Analyzed",
                "Recovery Initiated",
                "Recovered",
                "Escalated",
                "Stopped",
              ]}
            />
            <Button
              variant="ghost"
              onClick={() => {
                setQ("");
                setProblem("all");
                setPriority("all");
                setStatus("all");
              }}
            >
              Clear
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Transaction</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Problem</th>
                  <th className="px-4 py-3 font-medium">Recovery Probability</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">AI Recommended Action</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <EmptyRow colSpan={9} message="No cases match these filters." />}
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.customerName}</p>
                      <p className="text-xs text-muted-foreground">{c.id}</p>
                    </td>
                    <td className="tabular px-4 py-3 text-muted-foreground">{c.transactionId}</td>
                    <td className="tabular px-4 py-3 font-semibold">{formatINR(c.amount)}</td>
                    <td className="px-4 py-3">{c.problem}</td>
                    <td className="px-4 py-3">
                      <ProbabilityBar value={c.probability} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.recommendedAction}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/cases/$caseId" params={{ caseId: c.id }}>
                          Open
                        </Link>
                      </Button>
                    </td>
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

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}s</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
