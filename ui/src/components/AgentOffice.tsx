/**
 * AgentOffice — 2D pixel-art office floor with rich agent popover cards.
 * Hover any desk → floating card with: status, budget, last run, active tasks, RUN / VIEW / COMPACT actions.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { formatCents } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import { issuesApi } from "@/api/issues";
import { heartbeatsApi } from "@/api/heartbeats";
import { agentsApi } from "@/api/agents";
import type { Agent, Issue } from "@paperclipai/shared";
import {
  Zap,
  ExternalLink,
  Loader2,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  Hash,
  PauseCircle,
  PlayCircle,
  StopCircle,
  RefreshCw,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const GOLD = "#C9A84C";
const DESK_W = 136;
const DESK_H = 148;

const STATUS_COLOR: Record<string, string> = {
  running: "#34d399",
  idle: "#818cf8",
  error: "#f87171",
  paused: "#fbbf24",
  pending_approval: "#fb923c",
  terminated: "#374151",
};

const STATUS_LABEL: Record<string, string> = {
  running: "Running",
  idle: "Standby",
  error: "Error",
  paused: "Paused",
  pending_approval: "Approval",
  terminated: "Terminated",
};

const ISSUE_STATUS_ICON: Record<string, React.ReactNode> = {
  todo: <Clock className="h-3 w-3 text-slate-400" />,
  in_progress: <Loader2 className="h-3 w-3 animate-spin text-blue-400" />,
  done: <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
  cancelled: <XCircle className="h-3 w-3 text-slate-500" />,
  blocked: <AlertCircle className="h-3 w-3 text-red-400" />,
  backlog: <Clock className="h-3 w-3 text-slate-600" />,
};

const AGENT_ROLES: Record<string, string> = {
  egide: "Operator",
  maureen: "Coordinator",
  austin: "Strategist",
  action: "Comms Lead",
  emmanuel: "Field Agent",
  sohaib: "Engineer",
  razor: "Intelligence",
  francis: "Chairman",
  michal: "Analyst",
  coding: "Builder",
  comms: "Voice",
  strategy: "Planner",
  drafts: "Writer",
  research: "Scout",
};

const PALETTES = [
  { desk: "#1e1b4b", monitor: "#312e81", accent: "#818cf8" },
  { desk: "#064e3b", monitor: "#065f46", accent: "#34d399" },
  { desk: "#451a03", monitor: "#78350f", accent: "#fb923c" },
  { desk: "#0c4a6e", monitor: "#075985", accent: "#38bdf8" },
  { desk: "#3b0764", monitor: "#4a044e", accent: "#c084fc" },
  { desk: "#450a0a", monitor: "#7f1d1d", accent: "#f87171" },
  { desk: "#14532d", monitor: "#166534", accent: "#86efac" },
  { desk: "#1e1b4b", monitor: "#2d2a70", accent: "#a78bfa" },
];

const LEGEND_ITEMS = [
  { color: "#34d399", label: "Running" },
  { color: "#818cf8", label: "Standby" },
  { color: "#fbbf24", label: "Paused" },
  { color: "#f87171", label: "Error" },
];

const STATUS_ORDER = ["running", "error", "paused", "pending_approval", "idle", "terminated"];

type AvatarPos = { x: number; y: number; homeX: number; homeY: number };

function getRole(name: string) {
  const l = name.toLowerCase();
  for (const [k, v] of Object.entries(AGENT_ROLES)) if (l.includes(k)) return v;
  return "Agent";
}

function getPalette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return PALETTES[h % PALETTES.length];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function summarizeTaskTitle(title?: string | null) {
  if (!title) return "Idle";
  return title
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
    .replace(/[^\w\- ]/g, "") || "Task";
}

function getDeskAnchor(index: number, cols: number) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: 12 + col * (DESK_W + 10) + 56,
    y: 48 + row * (DESK_H + 24) + 18,
  };
}

function useHeartbeatTrigger(agentId: string, agentName: string, companyId: string) {
  const { pushToast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/agents/${agentId}/heartbeat/invoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paperclip-company-id": companyId,
          "x-paperclip-local-trusted": "true",
        },
        body: JSON.stringify({ source: "on_demand", triggerDetail: "manual" }),
      });
      if (!r.ok) throw new Error((await r.text()) || "Failed");
      return r.json();
    },
    onSuccess: () => {
      pushToast({ title: `◈ ${agentName} triggered`, tone: "success" });
      qc.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId, agentId) });
      qc.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
    },
    onError: (e) =>
      pushToast({ title: "Trigger failed", body: e instanceof Error ? e.message : "Unknown", tone: "error" }),
  });
}

interface PopoverProps {
  agent: Agent;
  companyId: string;
  anchorRect: DOMRect | null;
  containerRect: DOMRect | null;
}

function AgentPopover({ agent, companyId, anchorRect, containerRect }: PopoverProps) {
  const navigate = useNavigate();
  const trigger = useHeartbeatTrigger(agent.id, agent.name, companyId);
  const qc = useQueryClient();
  const { pushToast } = useToast();

  const onActionSuccess = (msg: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) });
    qc.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
    pushToast({ title: msg, tone: "success" });
  };
  const onActionError = (err: unknown) => {
    pushToast({ title: "Action failed", body: err instanceof Error ? err.message : "Unknown error", tone: "error" });
  };

  const pauseMut = useMutation({ mutationFn: () => agentsApi.pause(agent.id, companyId || undefined), onSuccess: () => onActionSuccess("Agent paused"), onError: onActionError });
  const resumeMut = useMutation({ mutationFn: () => agentsApi.resume(agent.id, companyId || undefined), onSuccess: () => onActionSuccess("Agent resumed"), onError: onActionError });
  const terminateMut = useMutation({ mutationFn: () => agentsApi.terminate(agent.id, companyId || undefined), onSuccess: () => onActionSuccess("Agent terminated"), onError: onActionError });
  const resetMut = useMutation({ mutationFn: () => agentsApi.resetSession(agent.id, null, companyId || undefined), onSuccess: () => onActionSuccess("Session context reset"), onError: onActionError });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId, { assigneeAgentId: agent.id }),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const { data: heartbeats } = useQuery({
    queryKey: queryKeys.heartbeats(companyId, agent.id),
    queryFn: () => heartbeatsApi.list(companyId, agent.id),
    enabled: !!companyId,
    staleTime: 15_000,
  });

  const activeTasks = useMemo(() => (issues ?? []).filter((i) => !["done", "cancelled"].includes(i.status)), [issues]);
  const lastRun = heartbeats?.[0] ?? null;
  const color = STATUS_COLOR[agent.status] ?? "#6b7280";
  const budgetUsed = agent.budgetMonthlyCents > 0 ? Math.min(100, (agent.spentMonthlyCents / agent.budgetMonthlyCents) * 100) : 0;

  let style: React.CSSProperties = { position: "fixed", top: 0, left: 0, zIndex: 9999 };
  if (anchorRect && containerRect) {
    const cardW = 280;
    const cardH = 380;
    let left = anchorRect.right + 8;
    let top = anchorRect.top;
    if (left + cardW > window.innerWidth - 8) left = anchorRect.left - cardW - 8;
    if (top + cardH > window.innerHeight - 8) top = window.innerHeight - cardH - 8;
    style = { ...style, left, top };
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, x: -8 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, x: -8 }}
      transition={{ duration: 0.15 }}
      style={{
        ...style,
        width: 280,
        background: "oklch(0.10 0.008 260)",
        border: `1px solid ${color}44`,
        borderRadius: 12,
        boxShadow: `0 0 32px ${color}22, 0 8px 32px rgba(0,0,0,0.6)`,
        fontFamily: "monospace",
        overflow: "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${color}22`, background: `${color}0a` }}>
        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-black text-white">{agent.name}</div>
          <div className="text-[10px]" style={{ color: `${color}cc` }}>{getRole(agent.name)}</div>
        </div>
        <span className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest" style={{ background: `${color}18`, color }}>
          {STATUS_LABEL[agent.status] ?? agent.status}
        </span>
      </div>

      <div className="space-y-3 p-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest text-white/35">Monthly Budget</span>
            <span className="text-[10px] font-bold text-white/60">{formatCents(agent.spentMonthlyCents)} / {formatCents(agent.budgetMonthlyCents)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${budgetUsed}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: budgetUsed > 80 ? "#f87171" : budgetUsed > 50 ? "#fbbf24" : GOLD, boxShadow: `0 0 6px ${budgetUsed > 80 ? "#f87171" : GOLD}` }}
            />
          </div>
        </div>

        {lastRun && (
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Clock className="h-3 w-3 shrink-0 text-white/30" />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] uppercase tracking-widest text-white/30">Last Run</div>
              <div className="truncate text-[10px] text-white/70">{timeAgo(lastRun.createdAt)}</div>
            </div>
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: lastRun.status === "succeeded" ? "#34d39918" : "#f8717118", color: lastRun.status === "succeeded" ? "#34d399" : "#f87171" }}>
              {lastRun.status}
            </span>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest text-white/35">Active Tasks</span>
            <span className="text-[9px] text-white/40">{activeTasks.length} open</span>
          </div>
          {activeTasks.length === 0 ? (
            <p className="text-[10px] italic text-white/25">No open tasks</p>
          ) : (
            <div className="max-h-[96px] space-y-1 overflow-y-auto pr-0.5">
              {activeTasks.slice(0, 6).map((issue) => (
                <button
                  key={issue.id}
                  onClick={() => navigate(`/issues/${issue.identifier ?? issue.id}`)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-all"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  {ISSUE_STATUS_ICON[issue.status] ?? <Hash className="h-3 w-3 text-white/30" />}
                  <span className="flex-1 truncate text-[10px] text-white/70">{issue.title}</span>
                  <ChevronRight className="h-2.5 w-2.5 shrink-0 text-white/25" />
                </button>
              ))}
            </div>
          )}
        </div>

        {lastRun?.stdoutExcerpt && (
          <div className="rounded-lg px-2 py-1.5" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="mb-1 text-[9px] uppercase tracking-widest text-white/25">Last Output</div>
            <p className="line-clamp-3 text-[9px] leading-relaxed text-white/45">{lastRun.stdoutExcerpt.trim().slice(0, 160)}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 px-3 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
        <div className="flex items-center gap-1.5">
          <button onClick={() => trigger.mutate()} disabled={trigger.isPending || agent.status === "running"} className="flex-1 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40" style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}33` }}>
            <span className="inline-flex items-center gap-1">{trigger.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}Run</span>
          </button>
          <button onClick={() => navigate(`/agents/${agent.urlKey ?? agent.id}`)} className="flex-1 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}>
            <span className="inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />Detail</span>
          </button>
          <button onClick={() => navigate(`/issues?assigneeAgentId=${agent.id}`)} className="flex-1 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}>
            <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />Tasks</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {(agent.status === "running" || agent.status === "idle") && (
            <button onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending} className="flex-1 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="inline-flex items-center gap-1">{pauseMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PauseCircle className="h-3 w-3" />}Pause</span>
            </button>
          )}
          {agent.status === "paused" && (
            <button onClick={() => resumeMut.mutate()} disabled={resumeMut.isPending} className="flex-1 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="inline-flex items-center gap-1">{resumeMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}Resume</span>
            </button>
          )}
          {agent.status !== "terminated" && (
            <button onClick={() => window.confirm("Terminate this agent? This cannot be undone.") && terminateMut.mutate()} disabled={terminateMut.isPending} className="flex-1 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40" style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.4)" }}>
              <span className="inline-flex items-center gap-1">{terminateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3 w-3" />}Terminate</span>
            </button>
          )}
          <button onClick={() => resetMut.mutate()} disabled={resetMut.isPending} title="Clears the agent's active session context" className="flex-1 rounded-lg py-1.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40" style={{ background: `${GOLD}0f`, color: GOLD, border: `1px solid ${GOLD}33` }}>
            <span className="inline-flex items-center gap-1">{resetMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}Reset</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AgentAvatar({
  agent,
  pos,
  task,
}: {
  agent: Agent;
  pos: AvatarPos;
  task?: Issue;
}) {
  const color = STATUS_COLOR[agent.status] ?? "#6b7280";
  const isRunning = agent.status === "running";
  const label = summarizeTaskTitle(task?.title ?? (isRunning ? "On Duty" : "Standing By"));

  return (
    <div
      className="pointer-events-auto absolute group"
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -50%)",
        transition: `left ${isRunning ? 3 : 4.5}s ease-in-out, top ${isRunning ? 3 : 4.5}s ease-in-out`,
        zIndex: 30,
      }}
    >
      <div className="relative flex flex-col items-center gap-1">
        <div className="rounded px-1 py-0.5 text-[8px] font-black uppercase tracking-wide text-white/70" style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace" }}>
          {label}
        </div>
        <div className="relative h-6 w-4">
          {isRunning && (
            <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md" style={{ background: `${color}88` }} />
          )}
          <div className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-[2px]" style={{ background: color, boxShadow: `0 0 ${isRunning ? 12 : 7}px ${color}` }} />
          <div className="absolute left-1/2 top-2.5 h-2.5 w-3 -translate-x-1/2 rounded-[1px]" style={{ background: color }} />
          <div className="absolute left-[3px] top-4 h-2 w-[2px] rounded-full" style={{ background: color }} />
          <div className="absolute right-[3px] top-4 h-2 w-[2px] rounded-full" style={{ background: color }} />
          <div className="absolute left-[4px] top-[9px] h-2 w-[2px] rounded-full" style={{ background: color }} />
          <div className="absolute right-[4px] top-[9px] h-2 w-[2px] rounded-full" style={{ background: color }} />
        </div>
        {task && (
          <div className="pointer-events-none absolute bottom-full left-1/2 mb-9 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/70 px-1.5 py-1 text-[9px] text-white/80 shadow-lg group-hover:block">
            {task.title}
          </div>
        )}
      </div>
    </div>
  );
}

interface DeskCellProps {
  agent: Agent;
  onHover: (agent: Agent, rect: DOMRect) => void;
  onLeave: () => void;
  isActive: boolean;
}

function DeskCell({ agent, onHover, onLeave, isActive }: DeskCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);
  const pal = getPalette(agent.name);
  const color = STATUS_COLOR[agent.status ?? "idle"] ?? "#6b7280";
  const isRunning = agent.status === "running";
  const shortName = agent.name.replace(/\s+(Agent|Razor)\s*/gi, "").trim() || agent.name.split(" ")[0];
  const [scanY, setScanY] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => setScanY((y) => (y + 3) % 38), 55);
    return () => clearInterval(t);
  }, [isRunning]);

  return (
    <motion.div
      ref={cellRef}
      layout
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex cursor-pointer select-none flex-col items-center gap-0.5"
      style={{ width: DESK_W, minHeight: DESK_H, zIndex: 10 }}
      onMouseEnter={() => cellRef.current && onHover(agent, cellRef.current.getBoundingClientRect())}
      onMouseLeave={onLeave}
    >
      {isActive && <div className="pointer-events-none absolute inset-0 rounded-xl" style={{ boxShadow: `0 0 0 1.5px ${color}66, 0 0 16px ${color}22`, borderRadius: 10 }} />}

      <svg viewBox="0 0 110 100" width={110} height={100} xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="48" width="98" height="40" rx="4" fill={pal.desk} />
        <rect x="6" y="48" width="98" height="5" rx="2" fill={pal.monitor} opacity="0.55" />
        <rect x="14" y="83" width="5" height="17" rx="1.5" fill={pal.desk} opacity="0.65" />
        <rect x="91" y="83" width="5" height="17" rx="1.5" fill={pal.desk} opacity="0.65" />
        <rect x="51" y="30" width="8" height="20" rx="2" fill={pal.monitor} />
        <rect x="42" y="47" width="26" height="3" rx="1.5" fill={pal.monitor} opacity="0.45" />
        <rect x="24" y="5" width="62" height="40" rx="4" fill={pal.monitor} />
        <rect x="26" y="7" width="58" height="36" rx="3" fill="#080814" />
        {isRunning ? (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={i} x="29" y={10 + i * 6} width={10 + ((i * 9) % 36)} height="2" rx="1" fill={pal.accent} opacity={0.75 - i * 0.1} />
            ))}
            <rect x="26" y={7 + (scanY % 36)} width="58" height="2" fill={pal.accent} opacity="0.10" />
          </>
        ) : agent.status === "error" ? (
          <text x="55" y="32" textAnchor="middle" fontSize="16" fill="#f87171" fontFamily="monospace">!</text>
        ) : (
          [0, 1, 2].map((i) => <rect key={i} x="29" y={13 + i * 8} width={14 + i * 10} height="1.5" rx="1" fill={pal.accent} opacity="0.18" />)
        )}
        <circle cx="80" cy="11" r="2.5" fill={color} opacity="0.9" />
        {isRunning && <circle cx="80" cy="11" r="4.5" fill={color} opacity="0.2" />}
        <rect x="16" y="57" width="78" height="17" rx="2.5" fill={pal.monitor} opacity="0.4" />
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3, 4, 5, 6].map((col) => <rect key={`${row}-${col}`} x={18 + col * 11} y={59 + row * 3.5} width={9} height={2} rx="0.5" fill={pal.accent} opacity="0.14" />),
        )}
        <ellipse cx="97" cy="63" rx="5" ry="7" fill={pal.monitor} opacity="0.5" />
      </svg>

      <div className="mt-0.5 px-1 text-center leading-tight">
        <div className="w-full truncate text-[11px] font-black text-white/90" style={{ fontFamily: "monospace" }}>{shortName}</div>
        <div className="truncate text-[9px] font-bold" style={{ color: `${pal.accent}cc`, fontFamily: "monospace" }}>{getRole(agent.name)}</div>
        <div className="mt-0.5 text-[8px] uppercase tracking-wider" style={{ color }}>{STATUS_LABEL[agent.status] ?? agent.status}</div>
      </div>
    </motion.div>
  );
}

function OfficePlant({ x, y }: { x: number; y: number }) {
  return (
    <svg viewBox="0 0 36 44" width={36} height={44} style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }} xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="32" width="12" height="12" rx="2" fill="#4a2e1a" opacity="0.55" />
      <ellipse cx="18" cy="24" rx="13" ry="15" fill="#14532d" opacity="0.65" />
      <ellipse cx="10" cy="17" rx="7" ry="9" fill="#15803d" opacity="0.55" />
      <ellipse cx="26" cy="18" rx="7" ry="9" fill="#15803d" opacity="0.55" />
    </svg>
  );
}

function FloorTiles({ w, h }: { w: number; h: number }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="ft" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
          <rect width="28" height="28" fill="rgba(255,255,255,0.012)" />
          <rect width="28" height="28" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#ft)" />
    </svg>
  );
}

export const AgentOffice = React.memo(function AgentOffice({ agents, companyId }: { agents: Agent[] | undefined; companyId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(800);
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [avatarPositions, setAvatarPositions] = useState<Record<string, AvatarPos>>({});

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    setContainerW(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(() => [...(agents ?? [])].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)), [agents]);
  const cols = Math.max(2, Math.min(Math.max(sorted.length, 1), Math.floor((containerW - 16) / (DESK_W + 10)) || 2));
  const rows = Math.ceil(Math.max(sorted.length, 1) / cols);
  const floorH = rows * (DESK_H + 24) + 52;

  const deskMap = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    sorted.forEach((agent, index) => {
      map[agent.id] = getDeskAnchor(index, cols);
    });
    return map;
  }, [sorted, cols]);

  const activeTaskByAgent = useMemo(() => {
    const map: Record<string, Issue | undefined> = {};
    (issues ?? []).forEach((issue) => {
      if (!issue.assigneeAgentId) return;
      if (map[issue.assigneeAgentId]) return;
      if (["done", "cancelled"].includes(issue.status)) return;
      map[issue.assigneeAgentId] = issue;
    });
    return map;
  }, [issues]);

  useEffect(() => {
    const movingAgents = sorted.filter((agent) => agent.status === "running" || agent.status === "idle");
    setAvatarPositions((prev) => {
      const next: Record<string, AvatarPos> = {};
      movingAgents.forEach((agent) => {
        const anchor = deskMap[agent.id];
        const existing = prev[agent.id];
        next[agent.id] = existing
          ? { ...existing, homeX: anchor.x, homeY: anchor.y }
          : { x: anchor.x, y: anchor.y, homeX: anchor.x, homeY: anchor.y };
      });
      return next;
    });
  }, [deskMap, sorted]);

  useEffect(() => {
    const movingAgents = sorted.filter((agent) => agent.status === "running" || agent.status === "idle");
    if (movingAgents.length === 0) return;

    const tick = () => {
      setAvatarPositions((prev) => {
        const next = { ...prev };
        movingAgents.forEach((agent) => {
          const current = prev[agent.id] ?? { ...deskMap[agent.id], homeX: deskMap[agent.id].x, homeY: deskMap[agent.id].y };
          const drift = agent.status === "running" ? 60 : 36;
          next[agent.id] = {
            homeX: current.homeX,
            homeY: current.homeY,
            x: clamp(current.homeX + (Math.random() - 0.5) * drift * 2, 18, Math.max(containerW - 18, 18)),
            y: clamp(current.homeY + (Math.random() - 0.5) * drift * 2, 36, Math.max(floorH - 18, 36)),
          };
        });
        return next;
      });
    };

    const interval = setInterval(tick, 4000);
    return () => clearInterval(interval);
  }, [containerW, deskMap, floorH, sorted]);

  const handleHover = (agent: Agent, rect: DOMRect) => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHoveredAgent(agent);
    setAnchorRect(rect);
  };

  const handleLeave = () => {
    leaveTimer.current = setTimeout(() => {
      setHoveredAgent(null);
      setAnchorRect(null);
    }, 200);
  };

  const handlePopoverEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  };

  return (
    <div className="flex flex-col gap-2" onClick={() => { setHoveredAgent(null); setAnchorRect(null); }}>
      <div className="flex items-center gap-4 px-1">
        {LEGEND_ITEMS.map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
            {label}
          </span>
        ))}
        <span className="ml-auto font-mono text-[9px] text-white/25">hover desk → details</span>
      </div>

      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-visible"
        style={{ background: "linear-gradient(160deg, oklch(0.10 0.006 260) 0%, oklch(0.07 0.005 260) 100%)", border: `1px solid ${GOLD}1e`, minHeight: floorH }}
      >
        <FloorTiles w={containerW} h={floorH} />
        <OfficePlant x={4} y={4} />
        <OfficePlant x={containerW - 42} y={4} />

        <div className="absolute left-1/2 top-2.5 -translate-x-1/2 rounded px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: `${GOLD}77`, background: "rgba(0,0,0,0.25)", border: `1px solid ${GOLD}18`, fontFamily: "monospace", zIndex: 40 }}>
          ◈ LFG OPERATIONS FLOOR
        </div>

        {sorted
          .filter((agent) => agent.status === "running" || agent.status === "idle")
          .map((agent) => {
            const pos = avatarPositions[agent.id];
            if (!pos) return null;
            return <AgentAvatar key={agent.id} agent={agent} pos={pos} task={activeTaskByAgent[agent.id]} />;
          })}

        <div className="relative flex flex-wrap justify-start gap-2.5 p-3 pt-9">
          {sorted.map((agent) => (
            <DeskCell key={agent.id} agent={agent} onHover={handleHover} onLeave={handleLeave} isActive={hoveredAgent?.id === agent.id} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {hoveredAgent && (
          <div onMouseEnter={handlePopoverEnter} onMouseLeave={handleLeave} onClick={(e) => e.stopPropagation()}>
            <AgentPopover agent={hoveredAgent} companyId={companyId} anchorRect={anchorRect} containerRect={containerRef.current?.getBoundingClientRect() ?? null} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
