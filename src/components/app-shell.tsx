import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  RefreshCw,
  ScrollText,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { errorMessage, loadAll, logout, refreshData } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/revenue-at-risk", label: "Revenue at Risk", icon: AlertTriangle },
  { to: "/cases", label: "Recovery Cases", icon: LifeBuoy },
  { to: "/transactions", label: "Transactions", icon: CreditCard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/audit", label: "Audit Trail", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const state = useAppState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const escalated = state.cases.filter((c) => c.status === "Escalated").length;
  const alerts =
    state.cases.filter((c) => c.status === "Detected").length + escalated;

  useEffect(() => {
    if (state.loaded || state.loading) return;
    void loadAll().catch((err: unknown) => {
      toast.error("Could not load data", { description: errorMessage(err) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refreshData();
      toast.success("Data refreshed", { description: "Live recovery signals are up to date." });
    } catch (err) {
      toast.error("Could not refresh data", { description: errorMessage(err) });
    } finally {
      setRefreshing(false);
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hit = state.cases.find(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.customerName.toLowerCase().includes(q) ||
        c.transactionId.toLowerCase().includes(q),
    );
    if (hit) {
      navigate({ to: "/cases/$caseId", params: { caseId: hit.id } });
      setQuery("");
    } else {
      toast.error("No match found", { description: `Nothing matches “${query}”.` });
    }
  }

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <ShieldCheck className="size-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">RecoverAI</p>
            <p className="text-[11px] text-sidebar-foreground/60">Revenue Recovery</p>
          </div>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active =
              pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-primary-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                {item.to === "/revenue-at-risk" && alerts > 0 && (
                  <span className="ml-auto rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {alerts}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="m-3 rounded-lg border border-sidebar-border bg-sidebar-accent p-3">
          <p className="text-xs font-semibold text-sidebar-accent-foreground">
            Don&apos;t just detect lost revenue.
          </p>
          <p className="text-xs text-sidebar-foreground/70">Recover it.</p>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <form onSubmit={onSearch} className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cases, customers or transactions…"
              className="pl-9"
            />
          </form>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh">
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="size-4" />
                  {alerts > 0 && (
                    <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {state.cases
                  .filter((c) => c.status === "Detected" || c.status === "Escalated")
                  .slice(0, 5)
                  .map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c.id } })}
                      className="flex-col items-start gap-0.5"
                    >
                      <span className="text-sm font-medium">
                        {c.problem} — {c.customerName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.id} · ₹{c.amount.toLocaleString("en-IN")} at risk
                      </span>
                    </DropdownMenuItem>
                  ))}
                {alerts === 0 && (
                  <div className="px-2 py-3 text-sm text-muted-foreground">All clear.</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:bg-accent">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    DA
                  </span>
                  <span className="hidden text-sm font-medium md:inline">Demo Analyst</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span>Demo Analyst</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    analyst@recoverai.in
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  <SettingsIcon className="size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Activity className="size-3" /> Live
                </Badge>
              </div>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </div>
          {state.error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Backend not reachable</p>
                <p className="text-destructive/80">{state.error}</p>
              </div>
            </div>
          )}
          {state.loading && !state.loaded ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-10 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" /> Loading live recovery data…
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
