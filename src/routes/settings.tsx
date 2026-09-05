import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { formatINR } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { updateSettings } from "@/lib/api";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Recovery Settings — RecoverAI" },
      {
        name: "description",
        content:
          "Configure recovery guardrails: maximum attempts, recovery window, high-value threshold, AI confidence and notifications.",
      },
      { property: "og:title", content: "Recovery Settings — RecoverAI" },
      {
        property: "og:description",
        content: "Tune the safety limits the AI recovery agent must respect.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings } = useAppState();
  const [draft, setDraft] = useState(settings);

  function save() {
    updateSettings(draft);
    toast.success("Settings saved", {
      description: "Guardrails apply to every recovery case immediately.",
    });
  }

  return (
    <AppShell
      title="Settings"
      subtitle="Recovery configuration and guardrails"
      actions={
        <Button onClick={save}>
          <Save className="size-4" /> Save changes
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Recovery guardrails</CardTitle>
            <CardDescription>Hard limits the AI agent can never cross</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="attempts">Maximum recovery attempts</Label>
              <Input
                id="attempts"
                type="number"
                min={1}
                max={10}
                value={draft.maxAttempts}
                onChange={(e) => setDraft({ ...draft, maxAttempts: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contacts">Maximum customer contacts</Label>
              <Input
                id="contacts"
                type="number"
                min={1}
                max={10}
                value={draft.maxContacts}
                onChange={(e) => setDraft({ ...draft, maxContacts: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="window">Recovery window (hours)</Label>
              <Input
                id="window"
                type="number"
                min={1}
                max={168}
                value={draft.recoveryWindowHours}
                onChange={(e) =>
                  setDraft({ ...draft, recoveryWindowHours: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="threshold">
                High-value threshold ({formatINR(draft.highValueThreshold)})
              </Label>
              <Input
                id="threshold"
                type="number"
                step={5000}
                value={draft.highValueThreshold}
                onChange={(e) =>
                  setDraft({ ...draft, highValueThreshold: Number(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Anything above this amount needs human approval before recovery runs.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>AI confidence</CardTitle>
              <CardDescription>
                Below this confidence the case goes to a human instead of auto-recovery
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Minimum confidence to act automatically</Label>
                <span className="tabular text-lg font-bold">{draft.aiConfidenceThreshold}%</span>
              </div>
              <Slider
                value={[draft.aiConfidenceThreshold]}
                min={30}
                max={95}
                step={1}
                onValueChange={([v]) => setDraft({ ...draft, aiConfidenceThreshold: v })}
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Who hears about recovery events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle
                label="Email alerts to revenue operations"
                checked={draft.notifyEmail}
                onChange={(v) => setDraft({ ...draft, notifyEmail: v })}
              />
              <Toggle
                label="Slack alerts for escalations"
                checked={draft.notifySlack}
                onChange={(v) => setDraft({ ...draft, notifySlack: v })}
              />
              <Toggle
                label="Allow automatic recovery actions"
                checked={draft.autoRecovery}
                onChange={(v) => setDraft({ ...draft, autoRecovery: v })}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
