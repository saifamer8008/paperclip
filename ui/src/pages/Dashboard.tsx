import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { dashboardApi } from "../api/dashboard";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ActivityRow } from "../components/ActivityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { timeAgo } from "../lib/timeAgo";
import { Link } from "@/lib/router";
import { issuesApi } from "../api/issues";
import {
  Bot, Radio, Wifi, History, CircleDotDashed,
} from "lucide-react";
import type { Agent, ActivityEvent, HeartbeatRun } from "@paperclipai/shared";

// ─────────────────────────────────────────────
//  Palette
// ─────────────────────────────────────────────
const GOLD  = "#C9A84C";
const GOLD2 = "#E8C97A";

// ─────────────────────────────────────────────
//  Clock
// ─────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }
function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}

// ─────────────────────────────────────────────
//  Status helpers
// ─────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  running: "#34d399",
  idle:    "#818cf8",
  error:   "#f87171",
  paused:  "#fbbf24",
  pending_approval: "#fb923c",
  terminated: "#4b5563",
};
const STATUS_LABEL: Record<string, string> = {
  running: "WORKING",
  idle:    "STANDBY",
  error:   "ERROR",
  paused:  "PAUSED",
  pending_approval: "PENDING",
  terminated: "OFF",
};

// ─────────────────────────────────────────────
//  Top bar
// ─────────────────────────────────────────────
function TopBar({ totalAgents, runningAgents }: { totalAgents: number; runningAgents: number }) {
  const now = useLiveClock();
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 rounded-xl shrink-0"
      style={{
        background: "rgba(0,0,0,0.55)",
        border: `1px solid ${GOLD}33`,
        fontFamily: "'Space Mono','Courier New',monospace",
      }}
    >
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 28 28" width={26} height={26}>
          <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" fill="none" stroke={GOLD} strokeWidth="1.5" />
          <text x="14" y="18" textAnchor="middle" fontSize="7" fontWeight="bold" fill={GOLD} fontFamily="monospace">LFG</text>
        </svg>
        <div>
          <div className="text-sm font-black tracking-[0.2em] uppercase" style={{ color: GOLD }}>MISSION CONTROL</div>
          <div className="text-[9px] tracking-[0.12em] uppercase" style={{ color: GOLD + "77" }}>LFG Unified Ops · Boss Interface</div>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-6">
        <div className="text-center">
          <div className="text-lg font-black tabular-nums" style={{ color: GOLD2 }}>{totalAgents}</div>
          <div className="text-[9px] tracking-widest uppercase" style={{ color: GOLD + "77" }}>Agents</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-black tabular-nums" style={{ color: runningAgents > 0 ? "#34d399" : GOLD2 }}>{runningAgents}</div>
          <div className="text-[9px] tracking-widest uppercase" style={{ color: GOLD + "77" }}>Active</div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-xl font-black tabular-nums" style={{ color: GOLD2, letterSpacing: "0.08em" }}>
          {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
        </div>
        <div className="hidden sm:flex flex-col gap-1">
          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded"
            style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
          </span>
          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded"
            style={{ background: "rgba(34,211,238,0.07)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}>
            <Wifi className="w-2.5 h-2.5" /> CONNECTED
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Agent card (reference-style)
// ─────────────────────────────────────────────
function AgentCard({ agent }: { agent: Agent }) {
  const color  = STATUS_COLOR[agent.status] ?? "#6b7280";
  const label  = STATUS_LABEL[agent.status]  ?? agent.status.toUpperCase();
  const initials = agent.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Link to={`/agents/${agent.urlKey ?? agent.id}`} className="no-underline block group">
      <div
        className="relative rounded-xl overflow-hidden transition-all duration-150 group-hover:translate-y-[-2px]"
        style={{
          background: "linear-gradient(160deg, rgba(15,15,20,0.9) 0%, rgba(5,5,10,0.95) 100%)",
          border: `1px solid ${color}33`,
          boxShadow: agent.status === "running" ? `0 0 18px ${color}18` : undefined,
        }}
      >
        {/* Avatar section */}
        <div
          className="relative flex items-center justify-center"
          style={{ height: 100, background: `linear-gradient(135deg, ${color}18 0%, rgba(0,0,0,0.4) 100%)` }}
        >
          <div
            className="flex items-center justify-center rounded-full font-black text-2xl"
            style={{
              width: 64, height: 64,
              background: `${color}22`,
              border: `2px solid ${color}66`,
              color,
              fontFamily: "monospace",
              boxShadow: agent.status === "running" ? `0 0 20px ${color}44` : undefined,
            }}
          >
            {initials}
          </div>
          {/* status dot */}
          <span
            className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          />
        </div>

        {/* Info section */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-1 mb-1">
            <div>
              <div className="text-sm font-black text-white/90 leading-tight" style={{ fontFamily: "monospace" }}>
                {agent.name.replace(" Agent", "")}
              </div>
              {agent.title && (
                <div className="text-[10px] mt-0.5" style={{ color: GOLD + "aa", fontFamily: "monospace" }}>
                  {agent.title}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <span
              className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded"
              style={{ color, background: `${color}18`, border: `1px solid ${color}33` }}
            >
              {label}
            </span>
            <span className="text-[9px] text-white/35 font-mono">
              {agent.lastHeartbeatAt ? timeAgo(agent.lastHeartbeatAt) : "Never"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
//  Live Feed panel (right rail)
// ─────────────────────────────────────────────
type FeedItem = {
  id: string;
  agentName: string;
  agentColor: string;
  text: string;
  ts: Date;
  type: "heartbeat" | "activity";
  status?: string;
};

function LiveFeedPanel({
  agents,
  agentMap,
  runs,
  activity,
  entityNameMap,
  entityTitleMap,
  selectedAgent,
  onSelectAgent,
}: {
  agents: Agent[];
  agentMap: Map<string, Agent>;
  runs: HeartbeatRun[];
  activity: ActivityEvent[];
  entityNameMap: Map<string, string>;
  entityTitleMap: Map<string, string>;
  selectedAgent: string | null;
  onSelectAgent: (id: string | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build unified feed from heartbeat runs + activity
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    for (const run of runs.slice(0, 40)) {
      const agent = agentMap.get(run.agentId);
      if (!agent) continue;
      const excerpt = run.stdoutExcerpt?.trim() || run.stderrExcerpt?.trim() || `Run ${run.status}`;
      items.push({
        id: `run-${run.id}`,
        agentName: agent.name.replace(" Agent", ""),
        agentColor: STATUS_COLOR[agent.status] ?? "#6b7280",
        text: excerpt.slice(0, 200),
        ts: new Date(run.createdAt),
        type: "heartbeat",
        status: run.status,
      });
    }

    for (const ev of activity.slice(0, 40)) {
      const agent = agentMap.get(ev.agentId ?? "");
      const entityKey = ev.entityType ? `${ev.entityType}:${ev.entityId}` : null;
      const entityTitle = entityKey ? (entityTitleMap.get(entityKey) ?? entityNameMap.get(entityKey) ?? "") : "";
      const text = `${ev.action}${entityTitle ? ` · ${entityTitle}` : ""}`;
      items.push({
        id: `act-${ev.id}`,
        agentName: agent?.name.replace(" Agent", "") ?? "System",
        agentColor: agent ? (STATUS_COLOR[agent.status] ?? "#6b7280") : "#6b7280",
        text,
        ts: new Date(ev.createdAt),
        type: "activity",
      });
    }

    return items.sort((a, b) => b.ts.getTime() - a.ts.getTime()).slice(0, 60);
  }, [runs, activity, agentMap, entityNameMap, entityTitleMap]);

  const filtered = useMemo(() => {
    if (!selectedAgent) return feed;
    const agent = agentMap.get(selectedAgent);
    if (!agent) return feed;
    const name = agent.name.replace(" Agent", "");
    return feed.filter(f => f.agentName === name);
  }, [feed, selectedAgent, agentMap]);

  const msgCount = feed.length;

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        background: "rgba(8,8,14,0.92)",
        border: `1px solid ${GOLD}22`,
        height: "100%",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0" style={{ borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
        <Radio className="h-4 w-4" style={{ color: "#34d399" }} />
        <span className="text-sm font-black tracking-widest uppercase" style={{ color: "#34d399", fontFamily: "monospace" }}>
          Live Feed
        </span>
        <span
          className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse"
          style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}
        >
          LIVE
        </span>
        <span className="ml-auto text-[9px] text-white/30 font-mono">{msgCount} events</span>
      </div>

      {/* Agent filter tabs */}
      <div className="flex gap-1 px-2 py-2 flex-wrap shrink-0" style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
        <button
          onClick={() => onSelectAgent(null)}
          className="text-[9px] font-bold px-2 py-0.5 rounded-full transition-all"
          style={{
            background: !selectedAgent ? `${GOLD}22` : "rgba(255,255,255,0.04)",
            color: !selectedAgent ? GOLD : "rgba(255,255,255,0.4)",
            border: `1px solid ${!selectedAgent ? GOLD + "44" : "transparent"}`,
            fontFamily: "monospace",
          }}
        >
          All
        </button>
        {agents.slice(0, 6).map(a => {
          const active = selectedAgent === a.id;
          const color = STATUS_COLOR[a.status] ?? "#6b7280";
          return (
            <button
              key={a.id}
              onClick={() => onSelectAgent(active ? null : a.id)}
              className="text-[9px] font-bold px-2 py-0.5 rounded-full transition-all"
              style={{
                background: active ? `${color}22` : "rgba(255,255,255,0.04)",
                color: active ? color : "rgba(255,255,255,0.4)",
                border: `1px solid ${active ? color + "44" : "transparent"}`,
                fontFamily: "monospace",
              }}
            >
              {a.name.replace(" Agent", "")}
            </button>
          );
        })}
      </div>

      {/* Feed items */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5" style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}33 transparent` }}>
        {filtered.length === 0 && (
          <p className="text-[10px] text-white/25 font-mono text-center py-8">No events yet</p>
        )}
        {filtered.map(item => (
          <div
            key={item.id}
            className="rounded-lg px-3 py-2"
            style={{
              background: item.type === "heartbeat"
                ? `linear-gradient(90deg, ${item.agentColor}0a 0%, rgba(0,0,0,0.2) 100%)`
                : "rgba(255,255,255,0.02)",
              border: `1px solid ${item.agentColor}18`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded"
                style={{ color: item.agentColor, background: `${item.agentColor}18`, fontFamily: "monospace" }}
              >
                {item.agentName}
              </span>
              {item.status && (
                <span className="text-[8px] font-bold tracking-widest uppercase text-white/30 font-mono">
                  {item.type === "heartbeat" ? item.status : "event"}
                </span>
              )}
              <span className="ml-auto text-[8px] text-white/25 font-mono">{timeAgo(item.ts)}</span>
            </div>
            <p className="text-[10px] text-white/65 leading-relaxed font-mono line-clamp-3">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Main Dashboard
// ─────────────────────────────────────────────
export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding }               = useDialog();
  const { setBreadcrumbs }               = useBreadcrumbs();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => { setBreadcrumbs([{ label: "Dashboard" }]); }, [setBreadcrumbs]);

  // ── Data queries
  const { data: summaryRaw, isLoading } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn:  () => dashboardApi.summary(selectedCompanyId!),
    enabled:  !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn:  () => agentsApi.list(selectedCompanyId!),
    enabled:  !!selectedCompanyId,
    refetchInterval: 10000,
  });

  const { data: activityRaw } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn:  () => activityApi.list(selectedCompanyId!),
    enabled:  !!selectedCompanyId,
    refetchInterval: 8000,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn:  () => projectsApi.list(selectedCompanyId!),
    enabled:  !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn:  () => issuesApi.list(selectedCompanyId!),
    enabled:  !!selectedCompanyId,
  });

  const { data: runsRaw } = useQuery({
    queryKey: ["heartbeat-runs-dashboard", selectedCompanyId],
    queryFn:  () => heartbeatsApi.list(selectedCompanyId!, undefined, 50),
    enabled:  !!selectedCompanyId,
    refetchInterval: 6000,
  });

  // ── Derived maps
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

  const activity      = useMemo(() => (activityRaw ?? []).slice(0, 60), [activityRaw]);
  const runs          = useMemo(() => (runsRaw ?? []).slice(0, 50), [runsRaw]);
  const totalAgents   = (agents ?? []).length;
  const runningAgents = (agents ?? []).filter(a => a.status === "running").length;
  const openIssues    = (issues  ?? []).filter(i => i.status !== "done" && i.status !== "cancelled").length;

  if (isLoading) return <PageSkeleton variant="dashboard" />;

  const hasNoAgents = agents !== undefined && agents.length === 0;

  return (
    <div
      className="flex flex-col gap-3 h-[calc(100vh-3.5rem)] overflow-hidden"
      style={{ fontFamily: "'Space Mono','Courier New',monospace" }}
    >
      {/* ── Top bar */}
      <TopBar totalAgents={totalAgents} runningAgents={runningAgents} />

      {/* ── Onboarding nudge */}
      {hasNoAgents && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl shrink-0"
          style={{ background: "rgba(201,168,76,0.05)", border: `1px solid ${GOLD}33` }}>
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
            <span className="text-sm text-white/70">No agents yet.</span>
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

      {/* ── Main body: Left (agents + activity) | Right (live feed) */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* LEFT column */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-hidden">

          {/* Agent grid */}
          <div className="shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD }}>
                <Bot className="h-3 w-3" /> Agent Status Board
              </div>
              <Link to="/agents" className="text-[10px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity" style={{ color: GOLD }}>
                Manage →
              </Link>
            </div>
            {(agents ?? []).length === 0 ? (
              <p className="text-[10px] text-white/30 font-mono py-4 text-center">No agents yet</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {(agents ?? [])
                  .sort((a, b) => {
                    const order = ["running","error","pending_approval","paused","idle","terminated"];
                    return order.indexOf(a.status) - order.indexOf(b.status);
                  })
                  .map(agent => <AgentCard key={agent.id} agent={agent} />)
                }
              </div>
            )}
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-2 shrink-0">
            {[
              { label: "Open Issues",  value: String(openIssues),   to: "/issues",   color: "#818cf8" },
              { label: "Active",       value: String(runningAgents), to: "/agents",   color: "#34d399" },
              { label: "Projects",     value: String((projects ?? []).length), to: "/projects", color: GOLD },
            ].map(s => (
              <Link key={s.label} to={s.to} className="no-underline">
                <div
                  className="rounded-xl px-3 py-2.5 hover:translate-y-[-1px] transition-transform"
                  style={{ background: `${s.color}0d`, border: `1px solid ${s.color}22` }}
                >
                  <div className="text-xl font-black tabular-nums" style={{ color: s.color, fontFamily: "monospace" }}>{s.value}</div>
                  <div className="text-[9px] tracking-widest uppercase mt-0.5" style={{ color: s.color + "88" }}>{s.label}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Activity feed */}
          <div className="flex-1 rounded-xl overflow-hidden flex flex-col min-h-0"
            style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${GOLD}18` }}>
            <div className="flex items-center justify-between px-3 py-2 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD }}>
                <History className="h-2.5 w-2.5" /> Activity Feed
              </div>
              <Link to="/activity" className="text-[9px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity" style={{ color: GOLD }}>
                All →
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1" style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}33 transparent` }}>
              {activity.length === 0 ? (
                <p className="text-[10px] text-white/25 font-mono text-center py-6">No activity yet</p>
              ) : (
                <div className="space-y-0.5">
                  {activity.map(ev => (
                    <ActivityRow
                      key={ev.id}
                      event={ev}
                      agentMap={agentMap}
                      entityNameMap={entityNameMap}
                      entityTitleMap={entityTitleMap}
                      className="px-2 py-1.5 hover:bg-white/[0.02] transition-colors rounded-md"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT rail — live feed */}
        <div className="w-[320px] xl:w-[360px] shrink-0">
          <LiveFeedPanel
            agents={agents ?? []}
            agentMap={agentMap}
            runs={runs}
            activity={activity}
            entityNameMap={entityNameMap}
            entityTitleMap={entityTitleMap}
            selectedAgent={selectedAgent}
            onSelectAgent={setSelectedAgent}
          />
        </div>

      </div>
    </div>
  );
}
