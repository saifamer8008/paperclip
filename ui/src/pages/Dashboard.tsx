import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { dashboardApi } from "../api/dashboard";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { ActivityRow } from "../components/ActivityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import {
  Bot, CircleDot, DollarSign, ShieldCheck, LayoutDashboard,
  AlertTriangle, Activity, Wifi, Zap, Radio,
} from "lucide-react";
import type { Agent, Issue } from "@paperclipai/shared";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "@/lib/router";
import { GlassCard } from "@/components/ui/glass-card";
import { AgentOffice } from "@/components/AgentOffice";

// ─────────────────────────────────────────────
//  LFG palette
// ─────────────────────────────────────────────
const GOLD = "#C9A84C";
const GOLD2 = "#E8C97A";
const CYAN = "#22D3EE";

// ─────────────────────────────────────────────
//  Live clock
// ─────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ─────────────────────────────────────────────
//  HUD top bar
// ─────────────────────────────────────────────
function HudBar({ totalAgents, runningAgents }: { totalAgents: number; runningAgents: number }) {
  const now = useLiveClock();
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-1"
      style={{
        background: "rgba(0,0,0,0.5)",
        border: `1px solid ${GOLD}33`,
        boxShadow: `0 0 30px rgba(201,168,76,0.08)`,
        fontFamily: "'Space Mono', 'Courier New', monospace",
      }}
    >
      {/* left: logo + title */}
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 28 28" width={28} height={28}>
          <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" fill="none" stroke={GOLD} strokeWidth="1.5" />
          <text x="14" y="18" textAnchor="middle" fontSize="7" fontWeight="bold" fill={GOLD} fontFamily="monospace">LFG</text>
        </svg>
        <div>
          <div className="text-sm font-black tracking-[0.2em] uppercase" style={{ color: GOLD }}>
            MISSION CONTROL
          </div>
          <div className="text-[10px] tracking-[0.15em] uppercase" style={{ color: GOLD + "88" }}>
            LFG Unified Operations · BOSS Interface
          </div>
        </div>
      </div>

      {/* centre: agent count */}
      <div className="hidden md:flex items-center gap-6">
        <div className="text-center">
          <div className="text-xl font-black tabular-nums" style={{ color: GOLD2 }}>{totalAgents}</div>
          <div className="text-[9px] tracking-widest uppercase" style={{ color: GOLD + "88" }}>Agents</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-black tabular-nums" style={{ color: runningAgents > 0 ? "#34d399" : GOLD2 }}>{runningAgents}</div>
          <div className="text-[9px] tracking-widest uppercase" style={{ color: GOLD + "88" }}>Active</div>
        </div>
      </div>

      {/* right: clock + badges */}
      <div className="flex items-center gap-4">
        <div
          className="text-2xl font-black tabular-nums"
          style={{ color: GOLD2, letterSpacing: "0.08em" }}
        >
          {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
        </div>
        <div className="hidden sm:flex flex-col gap-1">
          <span
            className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
          <span
            className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: "rgba(34,211,238,0.08)", color: CYAN, border: "1px solid rgba(34,211,238,0.2)" }}
          >
            <Wifi className="w-2.5 h-2.5" />
            CONNECTED
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Signal channels (progress bars)
// ─────────────────────────────────────────────
function SignalBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]" style={{ fontFamily: "monospace" }}>
      <span className="w-16 shrink-0 uppercase tracking-widest" style={{ color: GOLD + "88" }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="w-7 text-right font-bold" style={{ color }}>{value}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Agent status board (left panel)
// ─────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  running: "#34d399",
  idle: "#818cf8",
  error: "#f87171",
  paused: "#fbbf24",
  pending_approval: "#fb923c",
  terminated: "#4b5563",
};
const STATUS_TAG_BG: Record<string, string> = {
  running: "rgba(52,211,153,0.12)",
  idle: "rgba(129,140,248,0.12)",
  error: "rgba(248,113,113,0.12)",
  paused: "rgba(251,191,36,0.12)",
  pending_approval: "rgba(251,146,60,0.12)",
  terminated: "rgba(75,85,99,0.12)",
};
const STATUS_TAG_LABEL: Record<string, string> = {
  running: "WORKING",
  idle: "STANDBY",
  error: "ERROR",
  paused: "PAUSED",
  pending_approval: "PENDING",
  terminated: "OFF",
};

function AgentStatusBoard({ agents }: { agents: Agent[] }) {
  const sorted = [...agents].sort((a, b) => {
    const order = ["running", "error", "pending_approval", "paused", "idle", "terminated"];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  return (
    <div className="space-y-1.5">
      {sorted.map((agent) => {
        const color = STATUS_COLOR[agent.status] ?? "#6b7280";
        const tagBg = STATUS_TAG_BG[agent.status] ?? "rgba(107,114,128,0.12)";
        const tagLabel = STATUS_TAG_LABEL[agent.status] ?? agent.status.toUpperCase();
        return (
          <div
            key={agent.id}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
            style={{
              background: `linear-gradient(90deg, ${color}0d 0%, transparent 100%)`,
              border: `1px solid ${color}22`,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: agent.status === "running" ? color : "transparent", border: `1px solid ${color}` }} />
              <span className="text-xs font-medium truncate text-white/90" style={{ fontFamily: "monospace" }}>
                {agent.name.replace(" Agent", "")}
              </span>
            </div>
            <span
              className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded shrink-0"
              style={{ color, background: tagBg, border: `1px solid ${color}33` }}
            >
              {tagLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Command Snapshot panel (left)
// ─────────────────────────────────────────────
function CommandSnapshot({
  data,
  agents,
  activity,
  agentMap,
  entityNameMap,
  entityTitleMap,
  animatedIds,
}: {
  data: ReturnType<typeof useDashboardData>["data"];
  agents: Agent[];
  activity: ReturnType<typeof useDashboardData>["activity"];
  agentMap: Map<string, Agent>;
  entityNameMap: Map<string, string>;
  entityTitleMap: Map<string, string>;
  animatedIds: Set<string>;
}) {
  if (!data) return null;

  const runningAgents = agents.filter((a) => a.status === "running").length;
  const errorAgents   = agents.filter((a) => a.status === "error").length;
  const totalAgents   = agents.length;

  const signalPct = {
    freq:    Math.min(100, Math.round((data.tasks.inProgress / Math.max(1, data.tasks.open)) * 100)),
    agents:  totalAgents > 0 ? Math.round((runningAgents / totalAgents) * 100) : 0,
    website: 98,
    alerts:  errorAgents > 0 ? Math.min(100, errorAgents * 20) : 0,
    uptime:  99,
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Metric tiles */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Bot,         val: totalAgents,           label: "Active Agents",   to: "/agents",    alert: false },
          { icon: CircleDot,   val: data.tasks.inProgress, label: "In Progress",     to: "/issues",    alert: false },
          { icon: Zap,         val: data.tasks.blocked,    label: "Signals Blocked", to: "/issues",    alert: data.tasks.blocked > 0 },
          { icon: ShieldCheck, val: data.pendingApprovals, label: "Open Alerts",     to: "/approvals", alert: data.pendingApprovals > 0 },
        ].map(({ icon: Icon, val, label, to, alert }) => (
          <Link
            key={label}
            to={to}
            className="flex flex-col gap-1 p-3 rounded-xl no-underline text-inherit transition-all duration-150 hover:bg-white/[0.04]"
            style={{
              background: "rgba(0,0,0,0.35)",
              border: `1px solid ${alert ? "#f87171" : GOLD}22`,
            }}
          >
            <Icon className="h-3.5 w-3.5 mb-0.5" style={{ color: alert ? "#f87171" : GOLD + "cc" }} />
            <div className="text-2xl font-black tabular-nums" style={{ color: alert ? "#f87171" : GOLD2 }}>
              {typeof val === "number" ? val : val}
            </div>
            <div className="text-[10px] tracking-widest uppercase" style={{ color: GOLD + "66", fontFamily: "monospace" }}>
              {label}
            </div>
            {val === 0 && (
              <div className="mt-1 h-0.5 w-10 rounded" style={{ background: alert ? "#f87171" : GOLD + "44" }} />
            )}
          </Link>
        ))}
      </div>

      {/* ── Agent Status Board */}
      <div
        className="rounded-xl p-3 flex-1 min-h-0 overflow-y-auto space-y-1 scrollbar-hide"
        style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${GOLD}22` }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD }}>
            <Radio className="h-2.5 w-2.5" /> Agent Status Board
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold animate-pulse"
            style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
            LIVE
          </span>
        </div>
        <AgentStatusBoard agents={agents} />
      </div>

      {/* ── Signal Channels */}
      <div
        className="rounded-xl p-3 space-y-2"
        style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${GOLD}22` }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD }}>
            ◈ Signal Channels
          </div>
          <Link to="/costs" className="text-[9px] tracking-widest no-underline hover:opacity-80" style={{ color: GOLD + "88" }}>
            {formatCents(data.costs.monthSpendCents)}
          </Link>
        </div>
        <SignalBar label="Freq" value={signalPct.freq} color={CYAN} />
        <SignalBar label="Agents" value={signalPct.agents} color={GOLD} />
        <SignalBar label="Website" value={signalPct.website} color="#818cf8" />
        <SignalBar label="Alerts" value={signalPct.alerts} color={signalPct.alerts > 0 ? "#f87171" : "#34d399"} />
        <SignalBar label="Uptime" value={signalPct.uptime} color="#34d399" />
      </div>

      {/* ── Operations log (recent activity strip) */}
      <div
        className="rounded-xl p-3 space-y-1"
        style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${GOLD}22` }}
      >
        <div className="text-[10px] font-black tracking-widest uppercase mb-2" style={{ color: GOLD }}>
          ◈ Operations Log
        </div>
        {activity.length === 0 ? (
          <p className="text-[10px] text-white/30 font-mono"># No recent events</p>
        ) : (
          <div className="space-y-0.5 max-h-36 overflow-y-auto scrollbar-hide">
            {activity.slice(0, 8).map((event) => (
              <ActivityRow
                key={event.id}
                event={event}
                agentMap={agentMap}
                entityNameMap={entityNameMap}
                entityTitleMap={entityTitleMap}
                className={cn(
                  "px-0 py-0.5 text-[10px] font-mono text-white/60 hover:text-white/80 transition-colors",
                  animatedIds.has(event.id) && "activity-row-enter"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Data hook (centralised to avoid repeat)
// ─────────────────────────────────────────────
function useDashboardData(companyId: string) {
  const { data } = useQuery({
    queryKey: queryKeys.dashboard(companyId),
    queryFn:  () => dashboardApi.summary(companyId),
    enabled:  !!companyId,
  });
  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn:  () => agentsApi.list(companyId),
    enabled:  !!companyId,
  });
  const { data: activityRaw } = useQuery({
    queryKey: queryKeys.activity(companyId),
    queryFn:  () => activityApi.list(companyId),
    enabled:  !!companyId,
  });
  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn:  () => issuesApi.list(companyId),
    enabled:  !!companyId,
  });
  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(companyId),
    queryFn:  () => projectsApi.list(companyId),
    enabled:  !!companyId,
  });

  const activity = useMemo(() => (activityRaw ?? []).slice(0, 12), [activityRaw]);

  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents ?? []) m.set(a.id, a);
    return m;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of issues  ?? []) m.set(`issue:${i.id}`,   i.identifier ?? i.id.slice(0, 8));
    for (const a of agents  ?? []) m.set(`agent:${a.id}`,   a.name);
    for (const p of projects ?? []) m.set(`project:${p.id}`, p.name);
    return m;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of issues ?? []) m.set(`issue:${i.id}`, i.title);
    return m;
  }, [issues]);

  return { data, agents, activity, agentMap, entityNameMap, entityTitleMap };
}

// ─────────────────────────────────────────────
//  Main Dashboard
// ─────────────────────────────────────────────
export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding }               = useDialog();
  const { setBreadcrumbs }               = useBreadcrumbs();

  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef   = useRef<Set<string>>(new Set());
  const hydratedActivityRef  = useRef(false);
  const activityTimersRef    = useRef<number[]>([]);

  useEffect(() => { setBreadcrumbs([{ label: "Dashboard" }]); }, [setBreadcrumbs]);

  // Loading / dashboard summary
  const { data: summaryRaw, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn:  () => dashboardApi.summary(selectedCompanyId!),
    enabled:  !!selectedCompanyId,
  });

  const {
    agents, activity, agentMap, entityNameMap, entityTitleMap,
  } = useDashboardData(selectedCompanyId ?? "");

  // Activity animation
  useEffect(() => {
    for (const t of activityTimersRef.current) window.clearTimeout(t);
    activityTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (activity.length === 0) return;
    const seen = seenActivityIdsRef.current;
    const ids  = activity.map((e) => e.id);
    if (!hydratedActivityRef.current) {
      for (const id of ids) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }
    const newIds = ids.filter((id) => !seen.has(id));
    if (newIds.length === 0) { for (const id of ids) seen.add(id); return; }
    setAnimatedActivityIds((prev) => { const s = new Set(prev); for (const id of newIds) s.add(id); return s; });
    for (const id of newIds) seen.add(id);
    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => { const s = new Set(prev); for (const id of newIds) s.delete(id); return s; });
      activityTimersRef.current = activityTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityTimersRef.current.push(timer);
  }, [activity]);

  useEffect(() => () => { for (const t of activityTimersRef.current) window.clearTimeout(t); }, []);

  // Guards
  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return <EmptyState icon={LayoutDashboard} message="Welcome. Set up your first company and agent to get started." action="Get Started" onAction={openOnboarding} />;
    }
    return <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />;
  }
  if (isLoading || !summaryRaw) return <PageSkeleton variant="dashboard" />;

  const totalAgents   = summaryRaw.agents.active + summaryRaw.agents.running + summaryRaw.agents.paused + summaryRaw.agents.error;
  const runningAgents = summaryRaw.agents.running;
  const hasNoAgents   = agents !== undefined && agents.length === 0;

  return (
    <div
      className="flex flex-col gap-3 pb-6 min-h-[calc(100vh-4rem)]"
      style={{ fontFamily: "'Space Mono', 'Courier New', monospace" }}
    >
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {hasNoAgents && (
        <div
          className="flex items-center justify-between gap-3 p-3 rounded-xl text-sm"
          style={{ background: "rgba(201,168,76,0.05)", border: `1px solid ${GOLD}33` }}
        >
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
            <span className="text-white/70">No agents yet.</span>
          </div>
          <button
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
            className="text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-opacity"
            style={{ color: GOLD }}
          >
            Create Agent →
          </button>
        </div>
      )}

      {/* ── HUD bar */}
      <HudBar totalAgents={totalAgents} runningAgents={runningAgents} />

      {/* ── Main HUD body: Left command panel + Right office floor */}
      <div className="flex flex-col xl:flex-row gap-3 flex-1 min-h-0">

        {/* LEFT: Command Snapshot — fixed 340px */}
        <div className="xl:w-[340px] shrink-0">
          <CommandSnapshot
            data={summaryRaw}
            agents={agents ?? []}
            activity={activity}
            agentMap={agentMap}
            entityNameMap={entityNameMap}
            entityTitleMap={entityTitleMap}
            animatedIds={animatedActivityIds}
          />
        </div>

        {/* RIGHT: 2D Agent Office floor */}
        <div className="flex-1 min-w-0">
          <div
            className="h-full rounded-xl p-3 space-y-2"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${GOLD}22`,
              minHeight: 480,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD }}>
                <Activity className="h-2.5 w-2.5" /> Live Agent Office
              </div>
              <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded animate-pulse"
                style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                {runningAgents} ACTIVE
              </span>
            </div>
            <AgentOffice agents={agents} />
          </div>
        </div>

      </div>

      {/* ── Stale tasks alert bar */}
      {summaryRaw.staleTasks > 0 && (
        <div
          className="flex items-center justify-between gap-3 p-3 rounded-xl text-sm"
          style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.25)" }}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
            <span className="text-white/70">
              <span className="font-bold text-yellow-300">{summaryRaw.staleTasks}</span> stale tasks — not updated in over a week.
            </span>
          </div>
          <Link to="/issues?status=stale" className="text-xs font-bold uppercase tracking-widest no-underline hover:opacity-80 text-yellow-400 shrink-0">
            View →
          </Link>
        </div>
      )}
    </div>
  );
}
