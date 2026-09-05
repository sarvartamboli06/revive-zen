import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, ProbabilityBar, StatusBadge, formatINR } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, useAppState } from "@/lib/store";

export const Route = createFileRoute("/cases/")({
  head: () => ({
    meta: [
      { title: "Recovery Cases — RecoverAI" },
      {
        name: "description",
        content:
          "Open, escalated and recovered cases handled by the RecoverAI agent, with AI decisions and guardrail status.",
      },
      { property: "og:title", content: "Recovery Cases — RecoverAI" },
      {
        property: "og:description",
        content: "Work every recovery case from detection to verified payment.",
      },
    ],
  }),
  component: CasesPage,
});

const TABS = ["Open", "Escalated", "Recovered", "Stopped", "All"] as const;

function CasesPage() {
  const { cases } = useAppState();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Open");

  const rows = cases.filter((c) => {
    if (tab === "All") return true;
    if (tab === "Open")
      return c.status === "Detected" || c.status === "Analyzed" || c.status === "Recovery Initiated";
    return c.status === tab;
  });

  return (
    <AppShell title="Recovery Cases" subtitle="Each case carries its own AI decision and audit history">
      <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => (
          <Card key={c.id} className="shadow-card transition-shadow hover:shadow-panel">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{c.customerName}</CardTitle>
                  <CardDescription>
                    {c.id} · {c.transactionId}
                  </CardDescription>
                </div>
                <PriorityBadge priority={c.priority} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between">
                <p className="tabular text-2xl font-bold">{formatINR(c.amount)}</p>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-sm text-muted-foreground">{c.failureReason}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Recovery probability</span>
                <ProbabilityBar value={c.probability} />
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-xs">
                <span className="text-muted-foreground">AI decision</span>
                <span className="font-medium">{c.aiDecision}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Attempts {c.attempts}/3 · Contacts {c.contacts}/2
                </span>
                <span>{formatDateTime(c.createdAt)}</span>
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link to="/cases/$caseId" params={{ caseId: c.id }}>
                  Open case <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No cases in this view.</p>
        )}
      </div>
    </AppShell>
  );
}
