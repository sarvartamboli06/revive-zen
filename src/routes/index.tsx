import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, LineChart, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — RecoverAI Revenue Recovery" },
      {
        name: "description",
        content:
          "Sign in to RecoverAI to detect failed payments, run AI recovery decisions and track recovered revenue in one workspace.",
      },
      { property: "og:title", content: "Sign in — RecoverAI Revenue Recovery" },
      {
        property: "og:description",
        content: "Don't just detect lost revenue. Recover it.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  function enter() {
    setLoading(true);
    login();
    setTimeout(() => {
      toast.success("Signed in as Demo Analyst");
      navigate({ to: "/dashboard" });
    }, 450);
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <ShieldCheck className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">RecoverAI</span>
        </div>

        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Don&apos;t just detect lost revenue. Recover it.
          </h2>
          <p className="mt-4 text-sm text-sidebar-foreground/70">
            RecoverAI watches every failed payment and abandoned checkout, decides the safest
            recovery action, executes it and records a full audit trail.
          </p>
          <div className="mt-8 space-y-3 text-sm">
            {[
              { icon: Sparkles, text: "AI analysis with business-readable reasoning" },
              { icon: BadgeCheck, text: "Guardrails on attempts, contacts and high-value cases" },
              { icon: LineChart, text: "Verified recovery with live revenue impact" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <f.icon className="size-4 text-sidebar-primary-foreground" />
                <span className="text-sidebar-foreground/85">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-foreground/50">
          Detect → Understand → Decide → Recover → Verify → Audit
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
              <ShieldCheck className="size-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">RecoverAI</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Sign in to RecoverAI</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Access the revenue recovery workspace.
          </p>

          <div className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" defaultValue="analyst@recoverai.in" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" defaultValue="demo-access" />
            </div>
            <Button className="w-full" onClick={enter} disabled={loading}>
              Sign in
            </Button>

            <div className="relative py-1 text-center">
              <span className="relative z-10 bg-background px-3 text-xs uppercase tracking-wide text-muted-foreground">
                or
              </span>
              <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={enter} disabled={loading}>
              Continue with Demo Account
              <ArrowRight className="size-4" />
            </Button>

            <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-muted-foreground">
              <Lock className="size-3" /> Demo environment — no real credentials needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
