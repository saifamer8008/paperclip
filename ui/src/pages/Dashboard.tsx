import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { dashboardApi } from "../api/dashboard";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { ActivityRow } from "../components/ActivityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import { timeAgo } from "../lib/timeAgo";
import { Link, useNavigate } from "@/lib/router";
import { Bot, Wifi, History, Send, Info, CircleDotDashed, Zap, CheckCircle2 } from "lucide-react";
import type { Agent, ActivityEvent, HeartbeatRun, Issue } from "@paperclipai/shared";

// ─────────────────────────────────────────────────────────────────────────────
//  Palette
// ─────────────────────────────────────────────────────────────────────────────
const GOLD  = "#C9A84C";
const GOLD2 = "#E8C97A";

const STATUS_COLOR: Record<string, string> = {
  running: "#34d399",
  idle:    "#818cf8",
  error:   "#f87171",
  paused:  "#fbbf24",
  pending_approval: "#fb923c",
  terminated: "#6b7280",
};
const STATUS_LABEL: Record<string, string> = {
  running: "WORKING",
  idle:    "STANDBY",
  error:   "ERROR",
  paused:  "PAUSED",
  pending_approval: "PENDING",
  terminated: "OFF",
};

// Filter: team agents only (exclude razor-*, main, topic agents by urlKey/name pattern)
function isTeamAgent(agent: Agent): boolean {
  const key  = (agent.urlKey ?? "").toLowerCase();
  const name = (agent.name   ?? "").toLowerCase();
  // exclude razor topic/tool agents and "main"
  if (key === "main")  return false;
  if (key.startsWith("razor-")) return false;
  if (name.startsWith("razor-")) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Clock
// ─────────────────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }
function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Top bar
// ─────────────────────────────────────────────────────────────────────────────
function TopBar({ totalAgents, runningAgents }: { totalAgents: number; runningAgents: number }) {
  const now = useLiveClock();
  return (
    <div
      className="flex items-center justify-between px-5 py-3 rounded-2xl shrink-0"
      style={{
        background: "linear-gradient(90deg, rgba(10,9,15,0.95) 0%, rgba(18,14,8,0.95) 100%)",
        border: `1px solid ${GOLD}30`,
        boxShadow: `0 1px 30px rgba(201,168,76,0.06), inset 0 1px 0 rgba(201,168,76,0.08)`,
        fontFamily: "'Space Mono','Courier New',monospace",
      }}
    >
      <div className="flex items-center gap-3.5">
        <svg viewBox="0 0 32 32" width={30} height={30}>
          <polygon points="16,2 30,9 30,23 16,30 2,23 2,9" fill="none" stroke={GOLD} strokeWidth="1.2" />
          <polygon points="16,7 25,11.5 25,20.5 16,25 7,20.5 7,11.5" fill={GOLD} fillOpacity="0.07" stroke={GOLD} strokeWidth="0.6" strokeOpacity="0.4" />
          <text x="16" y="20" textAnchor="middle" fontSize="7.5" fontWeight="900" fill={GOLD} fontFamily="monospace" letterSpacing="0.5">LFG</text>
        </svg>
        <div>
          <div className="text-[13px] font-black tracking-[0.22em] uppercase" style={{ color: GOLD }}>MISSION CONTROL</div>
          <div className="text-[9px] tracking-[0.14em] uppercase" style={{ color: GOLD + "60" }}>Laissez-Faire Group · Boss Interface</div>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-8">
        {[
          { n: totalAgents,   label: "Agents",  color: GOLD2 },
          { n: runningAgents, label: "Active",   color: runningAgents > 0 ? "#34d399" : GOLD2 },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className="text-[22px] font-black tabular-nums leading-none" style={{ color: s.color }}>{s.n}</div>
            <div className="text-[8px] tracking-widest uppercase mt-0.5" style={{ color: s.color + "70" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-[22px] font-black tabular-nums" style={{ color: GOLD2, letterSpacing: "0.1em" }}>
          {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
        </div>
        <div className="hidden sm:flex flex-col gap-1">
          <span className="flex items-center gap-1 text-[9px] font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.22)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
          </span>
          <span className="flex items-center gap-1 text-[9px] font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: "rgba(34,211,238,0.06)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.18)" }}>
            <Wifi className="w-2.5 h-2.5" /> ONLINE
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Elite agent card — role icon glyph, no initials
// ─────────────────────────────────────────────────────────────────────────────

// Role → SVG path glyph (single path, centered in 40x40 viewBox)
function RoleGlyph({ role, color }: { role?: string; color: string }) {
  // Each glyph is a unique geometric shape — no text, no initials
  const glyphs: Record<string, string> = {
    ceo:        "M20 4 L28 14 H32 L20 36 L8 14 H12 Z",           // crown
    cto:        "M8 8 H32 V20 L20 36 L8 20 Z",                    // shield
    cmo:        "M20 6 C10 6 4 14 4 20 C4 30 12 36 20 36 C28 36 36 30 36 20 C36 14 30 6 20 6 M14 18 L20 24 L26 18", // signal
    cfo:        "M10 30 L10 18 L16 18 L16 30 M18 30 L18 12 L24 12 L24 30 M26 30 L26 22 L32 22 L32 30", // bars
    engineer:   "M12 20 L8 16 L12 12 M28 20 L32 16 L28 12 M22 8 L18 32", // code brackets
    designer:   "M20 8 L32 20 L20 32 L8 20 Z",                    // diamond
    pm:         "M8 10 H32 V30 H8 Z M8 15 H32 M14 10 V15 M26 10 V15", // calendar
    qa:         "M20 8 L34 28 H6 Z M20 18 V24 M20 27 V29",        // triangle warning
    devops:     "M20 6 L34 14 V26 L20 34 L6 26 V14 Z",            // hexagon
    researcher: "M16 16 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0-16 0 M22 22 L34 34", // magnify
    general:    "M20 6 L34 20 L20 34 L6 20 Z M20 12 L28 20 L20 28 L12 20 Z", // nested diamond
  };
  const d = glyphs[role ?? "general"] ?? glyphs.general;
  return (
    <svg viewBox="0 0 40 40" width={40} height={40}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
    </svg>
  );
}

function EliteCard({
  name, title, role, statusColor, statusLabel, lastSeen, isLive, isHuman,
  badge, onView, onPing,
}: {
  name: string; title?: string; role?: string;
  statusColor: string; statusLabel: string; lastSeen?: string;
  isLive: boolean; isHuman?: boolean; badge?: string;
  onView?: () => void; onPing?: () => void;
}) {
  const c = statusColor;
  return (
    <div className="group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.02] cursor-pointer"
      style={{
        background: "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.6) 100%)",
        border: `1px solid ${c}22`,
        boxShadow: isLive ? `0 0 20px ${c}1a, inset 0 1px 0 rgba(255,255,255,0.06)` : "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${c}0e 0%, transparent 65%)` }} />

      {/* Top color accent bar */}
      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${c}55, transparent)` }} />

      {/* Glyph zone */}
      <div className="flex flex-col items-center pt-4 pb-2 px-3 gap-2"
        style={{ background: `linear-gradient(180deg, ${c}08 0%, transparent 100%)` }}>
        {/* Live pulse ring */}
        <div className="relative flex items-center justify-center">
          {isLive && (
            <div className="absolute inset-[-6px] rounded-full animate-ping opacity-10"
              style={{ background: c }} />
          )}
          <div className="relative rounded-full flex items-center justify-center"
            style={{
              width: 52, height: 52,
              background: `radial-gradient(circle at 30% 30%, ${c}18, rgba(0,0,0,0.5))`,
              border: `1px solid ${c}30`,
              boxShadow: `inset 0 1px 0 ${c}20`,
            }}>
            <RoleGlyph role={role} color={c} />
          </div>
          {/* Status dot */}
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px]"
            style={{ background: c, borderColor: "rgba(5,5,10,1)", boxShadow: `0 0 5px ${c}` }} />
        </div>

        {/* Name */}
        <div className="text-center w-full">
          <div className="text-[12px] font-black tracking-wide leading-tight text-white/90 truncate"
            style={{ fontFamily: "monospace" }}>
            {name}
          </div>
          {badge && (
            <div className="text-[8px] font-black tracking-widest mt-0.5" style={{ color: GOLD, fontFamily: "monospace" }}>
              {badge}
            </div>
          )}
          {title && (
            <div className="text-[9px] mt-0.5 leading-tight text-white/40 truncate">{title}</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full"
            style={{ color: c, background: `${c}15`, border: `1px solid ${c}28`, fontFamily: "monospace" }}>
            {statusLabel}
          </span>
          <span className="text-[8px] text-white/25 font-mono">{lastSeen ?? "—"}</span>
        </div>
        {!isHuman && (
          <div className="flex gap-1">
            <button onClick={onView}
              className="flex-1 text-[8px] font-black tracking-widest py-1.5 rounded-lg transition-colors"
              style={{ background: `${c}12`, border: `1px solid ${c}25`, color: c, fontFamily: "monospace" }}>
              VIEW
            </button>
            <button onClick={onPing}
              className="flex-1 text-[8px] font-black tracking-widest py-1.5 rounded-lg transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
              PING
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RazorCard() {
  return (
    <EliteCard
      name="Saif Amer"
      title="President & Co-Founder"
      badge="RAZOR"
      role="ceo"
      statusColor="#34d399"
      statusLabel="ONLINE"
      isLive={false}
      isHuman={true}
    />
  );
}

// ─── Fixed 3-row team grid layout ─────────────────────────────────────────────
// Row 1: Saif + Francis (2, centered)
// Row 2: Austin + Egide + Action (3)
// Row 3: Maureen + Emmanuel + Sohaib + Michal (4, remaining)
// Match agent by name fragment (case-insensitive)
function findAgent(agents: Agent[], nameFrag: string): Agent | undefined {
  return agents.find(a => a.name.toLowerCase().includes(nameFrag.toLowerCase()));
}

const CARD_W = 170; // fixed card width in px

function TeamGrid({ agents, onPing }: { agents: Agent[]; onPing: (a: Agent) => void }) {
  const francis  = findAgent(agents, "francis");
  const austin   = findAgent(agents, "austin");
  const egide    = findAgent(agents, "egide");
  const action   = findAgent(agents, "action");
  const row2Set  = new Set([francis, austin, egide, action].filter(Boolean).map(a => a!.id));
  const row3     = agents.filter(a => !row2Set.has(a.id));

  const W = { width: CARD_W, minWidth: CARD_W, maxWidth: CARD_W };

  const Card = ({ agent }: { agent: Agent }) => (
    <div style={W}><AgentCard agent={agent} onPing={onPing} /></div>
  );

  return (
    <div className="flex flex-col gap-2.5 items-center">
      {/* Row 1: Saif + Francis */}
      <div className="flex gap-2.5 justify-center">
        <div style={W}><RazorCard /></div>
        {francis && <Card agent={francis} />}
      </div>
      {/* Row 2: Austin, Egide, Action */}
      <div className="flex gap-2.5 justify-center">
        {[austin, egide, action].filter(Boolean).map(a => <Card key={a!.id} agent={a!} />)}
      </div>
      {/* Row 3: everyone else */}
      {row3.length > 0 && (
        <div className="flex gap-2.5 justify-center flex-wrap">
          {row3.map(a => <Card key={a.id} agent={a} />)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function AgentCard({ agent, onPing }: { agent: Agent; onPing: (agent: Agent) => void }) {
  const navigate = useNavigate();
  const color = STATUS_COLOR[agent.status] ?? "#6b7280";
  const label = STATUS_LABEL[agent.status] ?? agent.status.toUpperCase();
  return (
    <EliteCard
      name={agent.name.replace(/\s*Agent\s*$/i, "")}
      title={agent.title ?? undefined}
      role={agent.role ?? undefined}
      statusColor={color}
      statusLabel={label}
      lastSeen={agent.lastHeartbeatAt ? timeAgo(agent.lastHeartbeatAt) : "Never"}
      isLive={agent.status === "running"}
      onView={() => navigate(`/agents/${agent.urlKey ?? agent.id}`)}
      onPing={() => onPing(agent)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Notion-style task row
// ─────────────────────────────────────────────────────────────────────────────
function TaskRow({ title, status, assignee, id }: { title: string; status: string; assignee?: string; id: string }) {
  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    todo:        { color: "#818cf8", bg: "rgba(129,140,248,0.1)",  label: "TODO" },
    in_progress: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",   label: "IN PROG" },
    in_review:   { color: "#22d3ee", bg: "rgba(34,211,238,0.1)",   label: "REVIEW" },
    blocked:     { color: "#f87171", bg: "rgba(248,113,113,0.1)",  label: "BLOCKED" },
    backlog:     { color: "#6b7280", bg: "rgba(107,114,128,0.1)",  label: "BACKLOG" },
    done:        { color: "#34d399", bg: "rgba(52,211,153,0.1)",   label: "DONE" },
  };
  const cfg = statusConfig[status] ?? { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: status.toUpperCase() };

  return (
    <Link to={`/issues/${id}`} className="no-underline block group">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:bg-white/[0.03]"
        style={{ border: "1px solid transparent" }}>
        <CircleDotDashed className="h-3 w-3 shrink-0" style={{ color: cfg.color }} />
        <span className="flex-1 text-[12px] text-white/75 truncate group-hover:text-white/95 transition-colors">{title}</span>
        {assignee && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ color: GOLD + "bb", background: GOLD + "12", fontFamily: "monospace" }}>
            {assignee}
          </span>
        )}
        <span className="text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full shrink-0"
          style={{ color: cfg.color, background: cfg.bg, fontFamily: "monospace" }}>
          {cfg.label}
        </span>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Command Panel (right rail) — ping / message / example
// ─────────────────────────────────────────────────────────────────────────────
type CmdTab = "compose" | "example";

const EXAMPLE_THREAD = [
  { from: "Razor", text: "Austin — Pose contract status. Where are we.", ts: "9:01 AM", sent: true },
  { from: "Austin", text: "Counter-party sent edits last night. Reviewing now. Should have redlines back to them by noon.", ts: "9:03 AM", sent: false },
  { from: "Razor", text: "Good. Egide — confirm the Ghana VASP filing is still tracking for Thursday.", ts: "9:04 AM", sent: true },
  { from: "Egide", text: "Confirmed. Docs are staged. Waiting on one KYC document from the partner side, following up now.", ts: "9:07 AM", sent: false },
  { from: "Razor", text: "Ping me the second that lands. Remind me Thursday 8am regardless.", ts: "9:08 AM", sent: true },
  { from: "System", text: "⏰ Reminder set: Ghana VASP filing check — Thursday 8:00 AM", ts: "9:08 AM", sent: false },
  { from: "Austin", text: "Also flagging — Syntax Capital LP agreement has a clause that needs Razor's eyes before we sign. Dropping it in issues.", ts: "9:15 AM", sent: false },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Bottlenecks panel
// ─────────────────────────────────────────────────────────────────────────────
function BottlenecksPanel({ issues, agentMap, companyId }: {
  issues: Issue[];
  agentMap: Map<string, Agent>;
  companyId: string;
}) {
  const qc = useQueryClient();
  const { pushToast } = useToast();

  const panicMutation = useMutation({
    mutationFn: async (issue: Issue) => {
      const agentId = issue.assigneeAgentId;
      if (!agentId) return;
      await agentsApi.wakeup(agentId,
        { source: "on_demand", triggerDetail: "manual", reason: `🚨 PANIC: "${issue.title}" is critically bottlenecked. Immediate action required.` },
        companyId
      );
    },
    onSuccess: (_, issue) => {
      pushToast({ title: `Pinged agent on: ${issue.title.slice(0, 40)}`, tone: "warn" });
      qc.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
    },
    onError: () => pushToast({ title: "Panic ping failed", tone: "error" }),
  });

  const panicAll = async () => {
    for (const issue of issues) {
      if (issue.assigneeAgentId) {
        await agentsApi.wakeup(issue.assigneeAgentId,
          { source: "on_demand", triggerDetail: "manual", reason: `🚨 ALL-HANDS: Critical bottleneck alert. Task "${issue.title}" needs immediate resolution.` },
          companyId
        );
      }
    }
    pushToast({ title: `Panic sent to ${issues.filter(i => i.assigneeAgentId).length} agents`, tone: "warn" });
  };

  if (issues.length === 0) return null;

  return (
    <div className="shrink-0 rounded-2xl overflow-hidden"
      style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.2)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid rgba(248,113,113,0.12)" }}>
        <div className="flex items-center gap-2">
          <span className="text-sm animate-pulse">🚨</span>
          <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#f87171", fontFamily: "monospace" }}>
            Bottlenecks
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)", fontFamily: "monospace" }}>
            {issues.length}
          </span>
        </div>
        <button
          onClick={panicAll}
          className="flex items-center gap-1.5 text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-full transition-all hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, rgba(248,113,113,0.25) 0%, rgba(239,68,68,0.2) 100%)",
            border: "1px solid rgba(248,113,113,0.5)",
            color: "#f87171",
            fontFamily: "monospace",
            boxShadow: "0 0 12px rgba(248,113,113,0.2)",
          }}
        >
          <Zap className="h-2.5 w-2.5" /> PANIC ALL
        </button>
      </div>

      {/* Task rows */}
      <div className="py-1">
        {issues.map(issue => {
          const agent = issue.assigneeAgentId ? agentMap.get(issue.assigneeAgentId) : null;
          const agentColor = agent ? (STATUS_COLOR[agent.status] ?? "#6b7280") : "#6b7280";
          return (
            <div key={issue.id}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.02] transition-colors group">
              <span className="text-[10px] animate-pulse">⚠️</span>
              <div className="flex-1 min-w-0">
                <Link to={`/issues/${issue.id}`} className="no-underline">
                  <span className="text-[11px] text-white/75 truncate block group-hover:text-white/95 transition-colors">
                    {issue.title}
                  </span>
                </Link>
                {agent && (
                  <span className="text-[9px] font-bold" style={{ color: agentColor, fontFamily: "monospace" }}>
                    {agent.name.replace(/\s*Agent\s*$/i, "")}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full shrink-0"
                style={{ color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", fontFamily: "monospace" }}>
                {issue.priority?.toUpperCase() ?? "CRITICAL"}
              </span>
              <button
                onClick={() => panicMutation.mutate(issue)}
                disabled={!issue.assigneeAgentId || panicMutation.isPending}
                className="shrink-0 text-[8px] font-black tracking-widest uppercase px-2 py-1 rounded-lg transition-all hover:scale-105 disabled:opacity-30"
                style={{
                  background: "rgba(248,113,113,0.12)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  color: "#f87171",
                  fontFamily: "monospace",
                }}
              >
                PING
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function CommandPanel({
  agents,
  selectedAgent,
  companyId,
  onSelectAgent,
}: {
  agents: Agent[];
  selectedAgent: Agent | null;
  companyId: string;
  onSelectAgent: (a: Agent | null) => void;
}) {
  const [tab, setTab] = useState<CmdTab>("compose");
  const [msg, setMsg] = useState("");
  const { pushToast } = useToast();
  const qc = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const wakeup = useMutation({
    mutationFn: (reason: string) =>
      agentsApi.wakeup(selectedAgent!.id, { source: "on_demand", triggerDetail: "manual", reason }, companyId),
    onSuccess: () => {
      pushToast({ title: `Pinged ${selectedAgent?.name}`, tone: "success" });
      qc.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
      setMsg("");
    },
    onError: () => pushToast({ title: "Failed to send", tone: "error" }),
  });

  const handleSend = () => {
    if (!msg.trim() || !selectedAgent) return;
    wakeup.mutate(msg.trim());
  };

  const teamAgents = agents.filter(isTeamAgent);

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden h-full"
      style={{ background: "rgba(8,7,14,0.95)", border: `1px solid ${GOLD}20` }}>

      {/* Header */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4" style={{ color: GOLD }} />
          <span className="text-[13px] font-black tracking-widest uppercase" style={{ color: GOLD, fontFamily: "monospace" }}>
            Command
          </span>
        </div>
        {/* Tab row */}
        <div className="flex gap-1">
          {([["compose", "Compose"], ["example", "How it works"]] as [CmdTab, string][]).map(([t, lbl]) => (
            <button key={t} onClick={() => setTab(t)}
              className="text-[10px] font-bold px-3 py-1 rounded-full transition-all"
              style={{
                background: tab === t ? `${GOLD}20` : "transparent",
                color: tab === t ? GOLD : "rgba(255,255,255,0.35)",
                border: `1px solid ${tab === t ? GOLD + "40" : "transparent"}`,
                fontFamily: "monospace",
              }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {tab === "example" ? (
        /* ── Example thread ── */
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}30 transparent` }}>
          <div className="mb-3 px-2 py-2 rounded-xl text-[10px] leading-relaxed"
            style={{ background: `${GOLD}0a`, border: `1px solid ${GOLD}20`, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
            <Info className="h-3 w-3 inline mr-1.5" style={{ color: GOLD }} />
            Select an agent, type a message, hit Send. It wakes the agent with your instruction as context. Responses appear in their heartbeat feed.
          </div>
          {EXAMPLE_THREAD.map((m, i) => (
            <div key={i} className={`flex flex-col gap-0.5 ${m.sent ? "items-end" : "items-start"}`}>
              <span className="text-[9px] font-bold px-1" style={{ color: m.sent ? GOLD + "99" : "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
                {m.from} · {m.ts}
              </span>
              <div className="max-w-[85%] px-3 py-2 rounded-2xl text-[11px] leading-relaxed"
                style={{
                  background: m.sent
                    ? `linear-gradient(135deg, ${GOLD}28 0%, ${GOLD}14 100%)`
                    : m.from === "System"
                      ? "rgba(52,211,153,0.08)"
                      : "rgba(255,255,255,0.05)",
                  border: m.sent
                    ? `1px solid ${GOLD}35`
                    : m.from === "System"
                      ? "1px solid rgba(52,211,153,0.2)"
                      : "1px solid rgba(255,255,255,0.08)",
                  color: m.sent ? "rgba(255,255,255,0.9)" : m.from === "System" ? "#34d399" : "rgba(255,255,255,0.75)",
                  fontFamily: m.from === "System" ? "monospace" : undefined,
                  fontSize: m.from === "System" ? "10px" : undefined,
                }}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Compose tab ── */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Agent selector */}
          <div className="px-3 pt-3 shrink-0">
            <div className="text-[9px] font-black tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
              Send to
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {teamAgents.map(a => {
                const active = selectedAgent?.id === a.id;
                const color = STATUS_COLOR[a.status] ?? "#6b7280";
                return (
                  <button key={a.id} onClick={() => onSelectAgent(active ? null : a)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                    style={{
                      background: active ? `${color}22` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${active ? color + "50" : "rgba(255,255,255,0.1)"}`,
                      color: active ? color : "rgba(255,255,255,0.45)",
                      fontFamily: "monospace",
                    }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    {a.name.replace(/\s*Agent\s*$/i, "")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent messages / activity for selected agent */}
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1.5" style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}30 transparent` }}>
            {!selectedAgent ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
                <Bot className="h-8 w-8" style={{ color: GOLD + "40" }} />
                <p className="text-[11px] text-white/20 font-mono text-center">Select an agent to<br />send a message or ping</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[9px] font-bold text-white/25 font-mono px-1 pt-1">Recent from {selectedAgent.name.replace(/\s*Agent\s*$/i, "")}</div>
                <div className="px-3 py-2.5 rounded-xl text-[11px] leading-relaxed"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>
                  Type a message below to wake this agent with your instructions as context. They'll respond in their next heartbeat run.
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="px-3 pb-3 shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={selectedAgent ? `Message ${selectedAgent.name.replace(/\s*Agent\s*$/i, "")}…` : "Select an agent first…"}
                disabled={!selectedAgent || wakeup.isPending}
                rows={2}
                className="flex-1 resize-none rounded-xl px-3 py-2 text-[11px] outline-none transition-all disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${selectedAgent ? GOLD + "35" : "rgba(255,255,255,0.08)"}`,
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: "monospace",
                  scrollbarWidth: "none",
                }}
              />
              <button
                onClick={handleSend}
                disabled={!selectedAgent || !msg.trim() || wakeup.isPending}
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all disabled:opacity-30 hover:scale-105"
                style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}44`, color: GOLD }}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding }               = useDialog();
  const { setBreadcrumbs }               = useBreadcrumbs();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  useEffect(() => { setBreadcrumbs([{ label: "Dashboard" }]); }, [setBreadcrumbs]);

  // ── Queries
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
    refetchInterval: 15000,
  });

  // ── Derived
  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents ?? []) m.set(a.id, a);
    return m;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of issues   ?? []) m.set(`issue:${i.id}`,   i.identifier ?? i.id.slice(0, 8));
    for (const a of agents   ?? []) m.set(`agent:${a.id}`,   a.name);
    for (const p of projects ?? []) m.set(`project:${p.id}`, p.name);
    return m;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of issues ?? []) m.set(`issue:${i.id}`, i.title);
    return m;
  }, [issues]);

  const teamAgents    = useMemo(() => (agents ?? []).filter(isTeamAgent), [agents]);
  const totalAgents   = teamAgents.length;
  const runningAgents = teamAgents.filter(a => a.status === "running").length;
  const activity      = useMemo(() => (activityRaw ?? []).slice(0, 50), [activityRaw]);

  // Tasks split: human (assigneeUserId set, no agent) vs agent
  const allOpen = useMemo(() =>
    (issues ?? []).filter(i => i.status !== "done" && i.status !== "cancelled" && i.status !== "backlog"),
    [issues]
  );
  const humanTasks = useMemo(() => allOpen.filter(i => !!i.assigneeUserId && !i.assigneeAgentId).slice(0, 6), [allOpen]);
  const agentTasks = useMemo(() => allOpen.filter(i => !!i.assigneeAgentId).slice(0, 6), [allOpen]);
  const unassignedTasks = useMemo(() => allOpen.filter(i => !i.assigneeUserId && !i.assigneeAgentId).slice(0, 4), [allOpen]);

  // Bottlenecks: blocked or critical+overdue (using priority=critical or status=blocked as proxy)
  const bottleneckTasks = useMemo(() =>
    (issues ?? [])
      .filter(i =>
        i.status !== "done" && i.status !== "cancelled" &&
        (i.priority === "critical" || i.status === "in_review")
      )
      .slice(0, 5),
    [issues]
  );

  // Agent name → short label for task assignee
  const agentShortName = (agentId: string | null | undefined) => {
    if (!agentId) return undefined;
    const a = agentMap.get(agentId);
    return a ? a.name.replace(/\s*Agent\s*$/i, "") : undefined;
  };

  if (isLoading) return <PageSkeleton variant="dashboard" />;

  const hasNoAgents = agents !== undefined && agents.length === 0;

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-3.5rem)] overflow-hidden"
      style={{ fontFamily: "'Space Mono','Courier New',monospace" }}>

      {/* Top bar */}
      <TopBar totalAgents={totalAgents} runningAgents={runningAgents} />

      {/* No agents nudge */}
      {hasNoAgents && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl shrink-0"
          style={{ background: "rgba(201,168,76,0.05)", border: `1px solid ${GOLD}30` }}>
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
            <span className="text-sm text-white/70">No agents yet.</span>
          </div>
          <button onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
            className="text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-opacity"
            style={{ color: GOLD }}>
            Create Agent →
          </button>
        </div>
      )}

      {/* ── Body: Left | Right ── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* ── LEFT COLUMN ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}22 transparent` }}>

          {/* SECTION: Team agents */}
          <div className="shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD, fontFamily: "monospace" }}>
                Team
              </span>
              <Link to="/agents" className="text-[9px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity"
                style={{ color: GOLD + "99" }}>
                All Agents →
              </Link>
            </div>
            {teamAgents.length === 0 ? (
              <p className="text-[10px] text-white/25 font-mono py-4 text-center">No team agents</p>
            ) : (
              <TeamGrid agents={teamAgents} onPing={setSelectedAgent} />
            )}
          </div>

          {/* SECTION: Open Tasks — split human / agent */}
          <div className="shrink-0 rounded-2xl overflow-hidden"
            style={{ background: "rgba(0,0,0,0.4)", border: `1px solid rgba(255,255,255,0.06)` }}>
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD, fontFamily: "monospace" }}>
                  Open Tasks
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: GOLD + "18", color: GOLD + "bb", fontFamily: "monospace" }}>
                  {allOpen.length}
                </span>
              </div>
              <Link to="/issues" className="text-[9px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity"
                style={{ color: GOLD + "99" }}>All →</Link>
            </div>

            <div className="grid grid-cols-2 divide-x divide-white/[0.04]">
              {/* Human tasks */}
              <div className="py-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <span className="text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full"
                    style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", fontFamily: "monospace" }}>
                    👤 Human
                  </span>
                </div>
                {humanTasks.length === 0 && unassignedTasks.length === 0 ? (
                  <p className="text-[9px] text-white/20 font-mono px-3 pb-2">None</p>
                ) : (
                  <>
                    {humanTasks.map(issue => (
                      <TaskRow key={issue.id} id={issue.id} title={issue.title} status={issue.status} assignee="Razor" />
                    ))}
                    {unassignedTasks.map(issue => (
                      <TaskRow key={issue.id} id={issue.id} title={issue.title} status={issue.status} />
                    ))}
                  </>
                )}
              </div>

              {/* Agent tasks */}
              <div className="py-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <span className="text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full"
                    style={{ color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", fontFamily: "monospace" }}>
                    🤖 Agent
                  </span>
                </div>
                {agentTasks.length === 0 ? (
                  <p className="text-[9px] text-white/20 font-mono px-3 pb-2">None</p>
                ) : (
                  agentTasks.map(issue => (
                    <TaskRow key={issue.id} id={issue.id} title={issue.title} status={issue.status}
                      assignee={agentShortName(issue.assigneeAgentId)} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SECTION: Bottlenecks */}
          <BottlenecksPanel issues={bottleneckTasks} agentMap={agentMap} companyId={selectedCompanyId ?? ""} />


          {/* SECTION: Activity feed */}
          <div className="flex-1 rounded-2xl overflow-hidden flex flex-col min-h-[200px]"
            style={{ background: "rgba(0,0,0,0.35)", border: `1px solid rgba(255,255,255,0.05)` }}>
            <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <History className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD, fontFamily: "monospace" }}>Activity</span>
              </div>
              <Link to="/activity" className="text-[9px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity"
                style={{ color: GOLD + "99" }}>
                All →
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-1" style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}22 transparent` }}>
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
                      className="px-2 py-1.5 hover:bg-white/[0.02] transition-colors rounded-lg"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── RIGHT RAIL: Command Panel ── */}
        <div className="w-[310px] xl:w-[340px] shrink-0">
          <CommandPanel
            agents={agents ?? []}
            selectedAgent={selectedAgent}
            companyId={selectedCompanyId ?? ""}
            onSelectAgent={setSelectedAgent}
          />
        </div>

      </div>
    </div>
  );
}
