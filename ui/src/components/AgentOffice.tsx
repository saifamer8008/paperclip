/**
 * AgentOffice — 2D pixel-art office floor with rich agent popover cards.
 * Hover any desk → floating card with: status, budget, last run, active tasks, RUN / VIEW / COMPACT actions.
 */
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/context/ToastContext";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { formatCents } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import { issuesApi } from "@/api/issues";
import { heartbeatsApi } from "@/api/heartbeats";
import type { Agent, Issue } from "@paperclipai/shared";
import {
  Zap, ExternalLink, Loader2, Package, DollarSign,
  AlertCircle, CheckCircle2, Clock, XCircle, Pause,
  ChevronRight, Hash, PauseCircle, PlayCircle, StopCircle, RefreshCw
} from "lucide-react";
import { agentsApi } from "@/api/agents";
import { motion, AnimatePresence } from "framer-motion";

// ─── palette ────────────────────────────────────────────────────────────────
const GOLD = "#C9A84C";

const STATUS_COLOR: Record<string, string> = {
  running:          "#34d399",
  idle:             "#818cf8",
  error:            "#f87171",
  paused:           "#fbbf24",
  pending_approval: "#fb923c",
  terminated:       "#374151",
};

const STATUS_LABEL: Record<string, string> = {
  running:          "Running",
  idle:             "Standby",
  error:            "Error",
  paused:           "Paused",
  pending_approval: "Approval",
  terminated:       "Terminated",
};

const ISSUE_STATUS_ICON: Record<string, React.ReactNode> = {
  todo:        <Clock className="h-3 w-3 text-slate-400" />,
  in_progress: <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />,
  done:        <CheckCircle2 className="h-3 w-3 text-emerald-400" />,
  cancelled:   <XCircle className="h-3 w-3 text-slate-500" />,
  blocked:     <AlertCircle className="h-3 w-3 text-red-400" />,
  backlog:     <Clock className="h-3 w-3 text-slate-600" />,
};

const AGENT_ROLES: Record<string, string> = {
  egide:    "Operator",    maureen:  "Coordinator",  austin:   "Strategist",
  action:   "Comms Lead",  emmanuel: "Field Agent",  sohaib:   "Engineer",
  razor:    "Intelligence",francis:  "Chairman",     michal:   "Analyst",
  coding:   "Builder",     comms:    "Voice",        strategy: "Planner",
  drafts:   "Writer",      research: "Scout",
};

function getRole(name: string) {
  const l = name.toLowerCase();
  for (const [k, v] of Object.entries(AGENT_ROLES)) if (l.includes(k)) return v;
  return "Agent";
}

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

function getPalette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return PALETTES[h % PALETTES.length];
}

// ─── heartbeat trigger ──────────────────────────────────────────────────────
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
      if (!r.ok) throw new Error(await r.text() || "Failed");
      return r.json();
    },
    onSuccess: () => {
      pushToast({ title: `◈ ${agentName} triggered`, tone: "success" });
      qc.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId, agentId) });
      qc.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
    },
    onError: (e) => pushToast({ title: "Trigger failed", body: e instanceof Error ? e.message : "Unknown", tone: "error" }),
  });
}

// ─── agent popover card ─────────────────────────────────────────────────────
interface PopoverProps {
  agent: Agent;
  companyId: string;
  onClose: () => void;
  anchorRect: DOMRect | null;
  containerRect: DOMRect | null;
}

function AgentPopover({ agent, companyId, onClose, anchorRect, containerRect }: PopoverProps) {
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

  const pauseMut = useMutation({
    mutationFn: () => agentsApi.pause(agent.id, companyId || undefined),
    onSuccess: () => onActionSuccess("Agent paused"),
    onError: onActionError,
  });
  const resumeMut = useMutation({
    mutationFn: () => agentsApi.resume(agent.id, companyId || undefined),
    onSuccess: () => onActionSuccess("Agent resumed"),
    onError: onActionError,
  });
  const terminateMut = useMutation({
    mutationFn: () => agentsApi.terminate(agent.id, companyId || undefined),
    onSuccess: () => onActionSuccess("Agent terminated"),
    onError: onActionError,
  });
  const resetMut = useMutation({
    mutationFn: () => agentsApi.resetSession(agent.id, null, companyId || undefined),
    onSuccess: () => onActionSuccess("Session context reset"),
    onError: onActionError,
  });

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

  const activeTasks = useMemo(
    () => (issues ?? []).filter((i) => !["done", "cancelled"].includes(i.status)),
    [issues]
  );
  const lastRun = heartbeats?.[0] ?? null;
  const color = STATUS_COLOR[agent.status] ?? "#6b7280";
  const budgetUsed = agent.budgetMonthlyCents > 0
    ? Math.min(100, (agent.spentMonthlyCents / agent.budgetMonthlyCents) * 100)
    : 0;

  // Position: try right-of-anchor, flip left if off-screen
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
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ borderBottom: `1px solid ${color}22`, background: `${color}0a` }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black text-white truncate">{agent.name}</div>
          <div className="text-[10px]" style={{ color: `${color}cc` }}>{getRole(agent.name)}</div>
        </div>
        <span
          className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{ background: `${color}18`, color }}
        >
          {STATUS_LABEL[agent.status] ?? agent.status}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Budget bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-widest text-white/35">Monthly Budget</span>
            <span className="text-[10px] font-bold text-white/60">
              {formatCents(agent.spentMonthlyCents)} / {formatCents(agent.budgetMonthlyCents)}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${budgetUsed}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background: budgetUsed > 80 ? "#f87171" : budgetUsed > 50 ? "#fbbf24" : GOLD,
                boxShadow: `0 0 6px ${budgetUsed > 80 ? "#f87171" : GOLD}`,
              }}
            />
          </div>
        </div>

        {/* Last run */}
        {lastRun && (
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Clock className="h-3 w-3 text-white/30 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[9px] uppercase tracking-widest text-white/30">Last Run</div>
              <div className="text-[10px] text-white/70 truncate">{timeAgo(lastRun.createdAt)}</div>
            </div>
            <span
              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{
                background: lastRun.status === "succeeded" ? "#34d39918" : "#f8717118",
                color: lastRun.status === "succeeded" ? "#34d399" : "#f87171",
              }}
            >
              {lastRun.status}
            </span>
          </div>
        )}

        {/* Active tasks */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-widest text-white/35">Active Tasks</span>
            <span className="text-[9px] text-white/40">{activeTasks.length} open</span>
          </div>
          {activeTasks.length === 0 ? (
            <p className="text-[10px] text-white/25 italic">No open tasks</p>
          ) : (
            <div className="space-y-1 max-h-[96px] overflow-y-auto pr-0.5">
              {activeTasks.slice(0, 6).map((issue) => (
                <button
                  key={issue.id}
                  onClick={() => navigate(`/issues/${issue.identifier ?? issue.id}`)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-left transition-all"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                  }}
                >
                  {ISSUE_STATUS_ICON[issue.status] ?? <Hash className="h-3 w-3 text-white/30" />}
                  <span className="text-[10px] text-white/70 truncate flex-1">{issue.title}</span>
                  <ChevronRight className="h-2.5 w-2.5 text-white/25 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Last stdout */}
        {lastRun?.stdoutExcerpt && (
          <div
            className="px-2 py-1.5 rounded-lg"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Last Output</div>
            <p className="text-[9px] font-mono text-white/45 leading-relaxed line-clamp-3">
              {lastRun.stdoutExcerpt.trim().slice(0, 160)}
            </p>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div
        className="flex flex-col gap-1 px-3 py-2.5"
        style={{ borderTop: `1px solid rgba(255,255,255,0.06)`, background: "rgba(0,0,0,0.2)" }}
      >
        {/* Row 1: RUN / DETAIL / TASKS */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => trigger.mutate()}
            disabled={trigger.isPending || agent.status === "running"}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
            style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}33` }}
          >
            {trigger.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Run
          </button>
          <button
            onClick={() => navigate(`/agents/${agent.urlKey ?? agent.id}`)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <ExternalLink className="h-3 w-3" />
            Detail
          </button>
          <button
            onClick={() => navigate(`/issues?assigneeAgentId=${agent.id}`)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <Package className="h-3 w-3" />
            Tasks
          </button>
        </div>
        {/* Row 2: PAUSE / RESUME / TERMINATE / RESET */}
        <div className="flex items-center gap-1.5">
          {(agent.status === "running" || agent.status === "idle") && (
            <button
              onClick={() => pauseMut.mutate()}
              disabled={pauseMut.isPending}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              {pauseMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PauseCircle className="h-3 w-3" />}
              Pause
            </button>
          )}
          {agent.status === "paused" && (
            <button
              onClick={() => resumeMut.mutate()}
              disabled={resumeMut.isPending}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              {resumeMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
              Resume
            </button>
          )}
          {agent.status !== "terminated" && (
            <button
              onClick={() => {
                if (window.confirm("Terminate this agent? This cannot be undone.")) {
                  terminateMut.mutate();
                }
              }}
              disabled={terminateMut.isPending}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
              style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.4)" }}
            >
              {terminateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3 w-3" />}
              Terminate
            </button>
          )}
          <button
            onClick={() => resetMut.mutate()}
            disabled={resetMut.isPending}
            title="Clears the agent's active session context"
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
            style={{ background: `${GOLD}0f`, color: GOLD, border: `1px solid ${GOLD}33` }}
          >
            {resetMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Reset
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── presence dot ───────────────────────────────────────────────────────────
function PresenceDot({ color, isRunning }: { color: string; isRunning: boolean }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => setPos({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8 }), 1400);
    return () => clearInterval(t);
  }, [isRunning]);
  return (
    <motion.div animate={pos} transition={{ duration: 1.0, ease: "easeInOut" }} className="relative">
      <div className="w-3.5 h-3.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}, 0 0 16px ${color}55` }} />
      {isRunning && (
        <div className="absolute inset-0 rounded-full animate-ping" style={{ background: color, opacity: 0.3 }} />
      )}
    </motion.div>
  );
}

// ─── desk cell ──────────────────────────────────────────────────────────────
const DESK_W = 136;
const DESK_H = 148;

interface DeskCellProps {
  agent: Agent;
  companyId: string;
  onHover: (agent: Agent, rect: DOMRect) => void;
  onLeave: () => void;
  isActive: boolean;
}

function DeskCell({ agent, companyId, onHover, onLeave, isActive }: DeskCellProps) {
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
      className="relative flex flex-col items-center gap-0.5 cursor-pointer select-none"
      style={{ width: DESK_W, minHeight: DESK_H }}
      onMouseEnter={() => {
        if (cellRef.current) onHover(agent, cellRef.current.getBoundingClientRect());
      }}
      onMouseLeave={onLeave}
    >
      {/* glow ring when active/hovered */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: `0 0 0 1.5px ${color}66, 0 0 16px ${color}22`, borderRadius: 10 }}
        />
      )}

      {/* Desk SVG */}
      <svg viewBox="0 0 110 100" width={110} height={100} xmlns="http://www.w3.org/2000/svg">
        {/* desk surface */}
        <rect x="6" y="48" width="98" height="40" rx="4" fill={pal.desk} />
        <rect x="6" y="48" width="98" height="5" rx="2" fill={pal.monitor} opacity="0.55" />
        {/* desk legs */}
        <rect x="14" y="83" width="5" height="17" rx="1.5" fill={pal.desk} opacity="0.65" />
        <rect x="91" y="83" width="5" height="17" rx="1.5" fill={pal.desk} opacity="0.65" />
        {/* monitor stand */}
        <rect x="51" y="30" width="8" height="20" rx="2" fill={pal.monitor} />
        <rect x="42" y="47" width="26" height="3" rx="1.5" fill={pal.monitor} opacity="0.45" />
        {/* monitor screen */}
        <rect x="24" y="5" width="62" height="40" rx="4" fill={pal.monitor} />
        <rect x="26" y="7" width="58" height="36" rx="3" fill="#080814" />
        {/* screen content */}
        {isRunning ? (
          <>
            {[0,1,2,3,4].map((i) => (
              <rect key={i} x="29" y={10 + i*6} width={10 + (i*9) % 36} height="2" rx="1" fill={pal.accent} opacity={0.75 - i*0.1} />
            ))}
            <rect x="26" y={7 + (scanY % 36)} width="58" height="2" rx="0" fill={pal.accent} opacity="0.10" />
          </>
        ) : agent.status === "error" ? (
          <text x="55" y="32" textAnchor="middle" fontSize="16" fill="#f87171" fontFamily="monospace">!</text>
        ) : (
          [0,1,2].map((i) => (
            <rect key={i} x="29" y={13 + i*8} width={14+i*10} height="1.5" rx="1" fill={pal.accent} opacity="0.18" />
          ))
        )}
        {/* status lamp */}
        <circle cx="80" cy="11" r="2.5" fill={color} opacity="0.9" />
        {isRunning && <circle cx="80" cy="11" r="4.5" fill={color} opacity="0.2" />}
        {/* keyboard */}
        <rect x="16" y="57" width="78" height="17" rx="2.5" fill={pal.monitor} opacity="0.4" />
        {[0,1,2,3].map((row) =>
          [0,1,2,3,4,5,6].map((col) => (
            <rect key={`${row}-${col}`} x={18 + col*11} y={59 + row*3.5} width={9} height={2} rx="0.5" fill={pal.accent} opacity="0.14" />
          ))
        )}
        {/* mouse */}
        <ellipse cx="97" cy="63" rx="5" ry="7" fill={pal.monitor} opacity="0.5" />
      </svg>

      {/* Presence dot */}
      <div className="absolute" style={{ top: 0, left: "50%", transform: "translateX(-50%) translateY(-6px)" }}>
        <PresenceDot color={color} isRunning={isRunning} />
      </div>

      {/* Name + role */}
      <div className="text-center leading-tight px-1 mt-0.5">
        <div className="text-[11px] font-black text-white/90 truncate w-full" style={{ fontFamily: "monospace" }}>
          {shortName}
        </div>
        <div className="text-[9px] font-bold truncate" style={{ color: `${pal.accent}cc`, fontFamily: "monospace" }}>
          {getRole(agent.name)}
        </div>
        <div
          className="text-[8px] uppercase tracking-wider mt-0.5"
          style={{ color }}
        >
          {STATUS_LABEL[agent.status] ?? agent.status}
        </div>
      </div>
    </motion.div>
  );
}

// ─── floor decoration ───────────────────────────────────────────────────────
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

const LEGEND_ITEMS = [
  { color: "#34d399", label: "Running" },
  { color: "#818cf8", label: "Standby" },
  { color: "#fbbf24", label: "Paused" },
  { color: "#f87171", label: "Error" },
];

const STATUS_ORDER = ["running", "error", "paused", "pending_approval", "idle", "terminated"];

// ─── main component ──────────────────────────────────────────────────────────
export const AgentOffice = React.memo(function AgentOffice({ agents }: { agents: Agent[] | undefined }) {
  const { selectedCompanyId } = useCompany();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(800);
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    setContainerW(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(
    () => [...(agents ?? [])].sort((a, b) => (STATUS_ORDER.indexOf(a.status) ?? 99) - (STATUS_ORDER.indexOf(b.status) ?? 99)),
    [agents]
  );

  const cols = Math.max(2, Math.min(sorted.length, Math.floor((containerW - 16) / (DESK_W + 10))));
  const rows = Math.ceil(sorted.length / cols);
  const floorH = rows * (DESK_H + 24) + 52;

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

  if (!selectedCompanyId) return null;

  return (
    <div className="flex flex-col gap-2" onClick={() => { setHoveredAgent(null); setAnchorRect(null); }}>
      {/* legend */}
      <div className="flex items-center gap-4 px-1">
        {LEGEND_ITEMS.map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 5px ${color}` }} />
            {label}
          </span>
        ))}
        <span className="ml-auto text-[9px] text-white/25 font-mono">hover desk → details</span>
      </div>

      {/* floor */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-visible"
        style={{
          background: "linear-gradient(160deg, oklch(0.10 0.006 260) 0%, oklch(0.07 0.005 260) 100%)",
          border: `1px solid ${GOLD}1e`,
          minHeight: floorH,
        }}
      >
        <FloorTiles w={containerW} h={floorH} />
        <OfficePlant x={4} y={4} />
        <OfficePlant x={containerW - 42} y={4} />

        <div
          className="absolute top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-black tracking-[0.3em] uppercase px-3 py-0.5 rounded"
          style={{ color: `${GOLD}77`, background: "rgba(0,0,0,0.25)", border: `1px solid ${GOLD}18`, fontFamily: "monospace" }}
        >
          ◈ LFG OPERATIONS FLOOR
        </div>

        <div className="relative flex flex-wrap gap-2.5 p-3 pt-9 justify-start">
          {sorted.map((agent) => (
            <DeskCell
              key={agent.id}
              agent={agent}
              companyId={selectedCompanyId}
              onHover={handleHover}
              onLeave={handleLeave}
              isActive={hoveredAgent?.id === agent.id}
            />
          ))}
        </div>
      </div>

      {/* Floating popover — rendered outside the floor div via portal-like positioning */}
      <AnimatePresence>
        {hoveredAgent && (
          <div
            onMouseEnter={handlePopoverEnter}
            onMouseLeave={handleLeave}
            onClick={(e) => e.stopPropagation()}
          >
            <AgentPopover
              agent={hoveredAgent}
              companyId={selectedCompanyId}
              onClose={() => { setHoveredAgent(null); setAnchorRect(null); }}
              anchorRect={anchorRect}
              containerRect={containerRef.current?.getBoundingClientRect() ?? null}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
