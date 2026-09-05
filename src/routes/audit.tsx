import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyRow } from "@/components/bits";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — RecoverAI" },
      {
        name: "description",
        content:
          "A complete, timestamped record of every system, AI and human action taken on a recovery case.",
      },
      { property: "og:title", content: "Audit Trail — RecoverAI" },
      {
        property: "og:description",
        content: "Payment Failed → AI Analysed → Link Generated → Payment Recovered.",
      },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { audit } = useAppState();
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("all");

  const rows = [...audit]
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
    .filter(
      (a) =>
        (actor === "all" || a.actor === actor) &&
        (!q.trim() ||
          a.caseId.toLowerCase().includes(q.toLowerCase()) ||
          a.event.toLowerCase().includes(q.toLowerCase())),
    );

  return (
    <AppShell
      title="Audit Trail"
      subtitle="Payment Failed → AI Analysed → Recovery Link Generated → Payment Recovered"
    >
      <Card className="shadow-card">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by case ID or event"
                className="pl-9"
              />
            </div>
            <Select value={actor} onValueChange={setActor}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Actor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                {["System", "AI Agent", "Human"].map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Case ID</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Decision</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <EmptyRow colSpan={7} message="No audit entries match." />}
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="tabular px-4 py-3 text-muted-foreground">
                      {formatDateTime(a.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/cases/$caseId"
                        params={{ caseId: a.caseId }}
                        className="font-medium text-primary hover:underline"
                      >
                        {a.caseId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium">{a.event}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.decision}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.action}</td>
                    <td className="px-4 py-3">{a.result}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{a.actor}</Badge>
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
