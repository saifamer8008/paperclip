import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { dashboardApi } from "../api/dashboard";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { notionApi, type NotionTask, type NotionGoal, type NotionDeal } from "../api/notion";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { ActivityRow } from "../components/ActivityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import { EliteCard as EliteCardShared, RoleGlyph as RoleGlyphShared } from "../components/EliteCard";
import { timeAgo } from "../lib/timeAgo";
import { Link, useNavigate } from "@/lib/router";
import { Bot, Wifi, History, Send, Info, CircleDotDashed, Zap, CheckCircle2, MessageSquare } from "lucide-react";
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
const VIEWER_KEY = "dashboard_viewer_id";

function TopBar({
  totalAgents, runningAgents,
  teamAgents, viewerId, onViewerChange,
}: {
  totalAgents: number; runningAgents: number;
  teamAgents: Agent[]; viewerId: string | null;
  onViewerChange: (id: string | null) => void;
}) {
  const now = useLiveClock();
  const [pickerOpen, setPickerOpen] = useState(false);
  const viewer = teamAgents.find(a => a.id === viewerId) ?? null;
  const viewerColor = viewer ? (STATUS_COLOR[viewer.status] ?? "#6b7280") : GOLD;

  return (
    <div
      className="flex items-center justify-between px-5 py-3 rounded-2xl shrink-0 relative"
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
          <div className="text-[9px] tracking-[0.14em] uppercase" style={{ color: GOLD + "60" }}>Laissez-Faire Group · Command Dashboard</div>
        </div>
      </div>

      {/* ── Persona picker ── */}
      <div className="relative">
        <button
          onClick={() => setPickerOpen(p => !p)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:scale-[1.02]"
          style={{
            background: viewer ? `${viewerColor}12` : "rgba(255,255,255,0.04)",
            border: `1px solid ${viewer ? viewerColor + "30" : "rgba(255,255,255,0.1)"}`,
          }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: viewerColor, boxShadow: viewer ? `0 0 5px ${viewerColor}` : undefined }} />
          <span className="text-[10px] font-black tracking-widest uppercase"
            style={{ color: viewer ? viewerColor : "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
            {viewer ? viewer.name.replace(/\s*Agent\s*$/i, "") : "Razor"}
          </span>
          <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>▾</span>
        </button>

        {pickerOpen && (
          <div className="absolute top-full right-0 mt-1.5 rounded-2xl overflow-hidden z-50 min-w-[180px]"
            style={{ background: "rgba(8,7,14,0.98)", border: `1px solid ${GOLD}25`, boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)` }}>
            {/* Saif / Razor option at top */}
            <button
              onClick={() => { onViewerChange(null); setPickerOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-white/[0.04]"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-black tracking-widest leading-tight" style={{ color: !viewer ? GOLD : "rgba(255,255,255,0.75)", fontFamily: "monospace" }}>
                  Razor
                </span>
                <span className="text-[8px] leading-tight" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>Saif Amer</span>
              </div>
              {!viewer && <span className="ml-auto text-[8px]" style={{ color: GOLD }}>✓</span>}
            </button>
            {teamAgents.map(a => {
              const c = STATUS_COLOR[a.status] ?? "#6b7280";
              const isActive = viewer?.id === a.id;
              return (
                <button key={a.id}
                  onClick={() => { onViewerChange(a.id); setPickerOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-white/[0.04]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                  <span className="text-[10px] font-bold truncate"
                    style={{ color: isActive ? c : "rgba(255,255,255,0.65)", fontFamily: "monospace" }}>
                    {a.name.replace(/\s*Agent\s*$/i, "")}
                  </span>
                  {isActive && <span className="ml-auto text-[8px]" style={{ color: c }}>✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden md:flex items-center gap-8">
        {([
          { n: totalAgents,   label: "Total",   color: GOLD2 },
          { n: runningAgents, label: "Online",  color: runningAgents > 0 ? "#34d399" : GOLD2 },
          { n: teamAgents.filter(a => a.status === "error").length, label: "Error", color: "#f87171" },
        ] as Array<{ n: number; label: string; color: string }>).map(s => (
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

function TeamGrid({ agents, onPing, viewerAgent }: {
  agents: Agent[];
  onPing: (a: Agent) => void;
  viewerAgent: Agent | null;
}) {
  const francis  = findAgent(agents, "francis");
  const austin   = findAgent(agents, "austin");
  const egide    = findAgent(agents, "egide");
  const action   = findAgent(agents, "action");
  const row2Fixed = new Set([francis, austin, egide, action].filter(Boolean).map(a => a!.id));
  const viewerId  = viewerAgent?.id;

  // Row 3: everyone not in row 2 fixed set, and not the viewer (they're in row 1)
  const row3 = agents.filter(a => !row2Fixed.has(a.id) && a.id !== viewerId);

  const W = { width: CARD_W, minWidth: CARD_W, maxWidth: CARD_W };
  const Card = ({ agent }: { agent: Agent }) => (
    <div style={W}><AgentCard agent={agent} onPing={onPing} /></div>
  );

  // Row 1 left: viewer's own card (with "YOU" badge) or RazorCard if no viewer selected
  const Row1Left = () => (
    <div style={W}>
      {viewerAgent ? (
        <EliteCard
          name={viewerAgent.name.replace(/\s*Agent\s*$/i, "")}
          title={viewerAgent.title ?? undefined}
          badge="YOU"
          role={viewerAgent.role ?? undefined}
          statusColor={STATUS_COLOR[viewerAgent.status] ?? "#6b7280"}
          statusLabel={STATUS_LABEL[viewerAgent.status] ?? viewerAgent.status.toUpperCase()}
          lastSeen={viewerAgent.lastHeartbeatAt ? timeAgo(viewerAgent.lastHeartbeatAt) : "Never"}
          isLive={viewerAgent.status === "running"}
          isHuman={true}
        />
      ) : (
        <RazorCard />
      )}
    </div>
  );

  // Row 1 right: Francis (unless Francis is the viewer)
  const row1Right = (francis && francis.id !== viewerId) ? francis : null;

  return (
    <div className="flex flex-col gap-2.5 items-center">
      {/* Row 1: Viewer + Francis */}
      <div className="flex gap-2.5 justify-center">
        <Row1Left />
        {row1Right && <Card agent={row1Right} />}
      </div>
      {/* Row 2: Austin, Egide, Action (skip if they are the viewer) */}
      <div className="flex gap-2.5 justify-center">
        {[austin, egide, action]
          .filter((a): a is Agent => !!a && a.id !== viewerId)
          .map(a => <Card key={a.id} agent={a} />)}
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

function NotionTaskRow({ task }: { task: NotionTask }) {
  const c = PRIORITY_COLOR[task.priority] ?? "#64748b";
  return (
    <a href={task.url} target="_blank" rel="noreferrer" className="no-underline block group">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:bg-white/[0.03]"
        style={{ border: "1px solid transparent" }}>
        <svg viewBox="0 0 10 10" width={10} height={10} className="shrink-0">
          <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" fill="none" stroke={GOLD} strokeWidth="1" strokeOpacity="0.6" />
          <rect x="2" y="3" width="6" height="1" rx="0.5" fill={GOLD} fillOpacity="0.5" />
          <rect x="2" y="5.5" width="4" height="1" rx="0.5" fill={GOLD} fillOpacity="0.35" />
        </svg>
        <span className="flex-1 text-[12px] text-white/75 truncate group-hover:text-white/95 transition-colors">{task.name}</span>
        {task.priority && (
          <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full shrink-0"
            style={{ color: c, background: `${c}12`, border: `1px solid ${c}25`, fontFamily: "monospace" }}>
            {task.priority.toUpperCase()}
          </span>
        )}
        <span className="text-[8px] font-black tracking-wider text-white/20 font-mono shrink-0">Notion</span>
      </div>
    </a>
  );
}

// Rich card used in the Notion Tasks panel — shows name, lead, due, blocker
function NotionTaskCard({ task }: { task: NotionTask }) {
  const c = PRIORITY_COLOR[task.priority] ?? "#64748b";
  const lead = task.assignedTo?.[0] ?? task.assignee ?? null;
  const hasBlocker = task.blockers && task.blockers.trim().length > 0;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const now = Date.now();
  const isOverdue  = due && due.getTime() < now;
  const isDueSoon  = due && !isOverdue && due.getTime() - now < 48 * 60 * 60 * 1000;
  const dueColor   = isOverdue ? "#f87171" : isDueSoon ? "#fbbf24" : "#94a3b8";
  const dueLabel   = due
    ? isOverdue
      ? "OVERDUE"
      : due.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <a href={task.url} target="_blank" rel="noreferrer" className="no-underline block group">
      <div className="mx-3 mb-2 rounded-xl p-3 transition-all group-hover:bg-white/[0.04]"
        style={{
          background: hasBlocker ? "rgba(248,113,113,0.04)" : "rgba(255,255,255,0.025)",
          border: hasBlocker ? "1px solid rgba(248,113,113,0.15)" : `1px solid rgba(255,255,255,0.06)`,
        }}>
        {/* Title row */}
        <div className="flex items-start gap-2 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: c }} />
          <span className="flex-1 text-[12px] font-bold text-white/85 leading-snug group-hover:text-white transition-colors">
            {task.name}
          </span>
          {task.priority && (
            <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full shrink-0 mt-0.5"
              style={{ color: c, background: `${c}18`, border: `1px solid ${c}30`, fontFamily: "monospace" }}>
              {task.priority.toUpperCase()}
            </span>
          )}
        </div>
        {/* Meta row */}
        <div className="flex items-center gap-3 pl-3.5 flex-wrap">
          {lead && (
            <span className="flex items-center gap-1 text-[10px] font-bold font-mono" style={{ color: GOLD + "cc" }}>
              <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="2.5" r="1.8" fill="currentColor" opacity="0.7"/><path d="M1 7c0-1.657 1.343-3 3-3s3 1.343 3 3" fill="currentColor" opacity="0.5"/></svg>
              {lead}
            </span>
          )}
          {dueLabel && (
            <span className="flex items-center gap-1 text-[10px] font-bold font-mono" style={{ color: dueColor }}>
              <svg width="8" height="8" viewBox="0 0 8 8"><rect x="0.5" y="1" width="7" height="6.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1"/><path d="M0.5 3h7" stroke="currentColor" strokeWidth="0.8"/><rect x="2" y="0.5" width="1" height="1.5" rx="0.5" fill="currentColor"/><rect x="5" y="0.5" width="1" height="1.5" rx="0.5" fill="currentColor"/></svg>
              {dueLabel}
            </span>
          )}
          {task.status && (
            <span className="text-[9px] font-mono text-white/30">{task.status}</span>
          )}
        </div>
        {/* Blocker row */}
        {hasBlocker && (
          <div className="mt-2 pl-3.5 flex items-start gap-1.5">
            <svg width="9" height="9" viewBox="0 0 9 9" className="shrink-0 mt-0.5">
              <path d="M4.5 1L8.5 8H0.5L4.5 1Z" fill="none" stroke="#f87171" strokeWidth="1.2"/>
              <path d="M4.5 4.5v1.5" stroke="#f87171" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="4.5" cy="7" r="0.5" fill="#f87171"/>
            </svg>
            <span className="text-[10px] font-mono leading-snug" style={{ color: "#f87171" }}>
              {task.blockers}
            </span>
          </div>
        )}
      </div>
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Command Panel (right rail) — ping / message / example
// ─────────────────────────────────────────────────────────────────────────────
type CmdTab = "compose" | "example" | "models";

const EXAMPLE_THREAD = [
  {
    kind: "intro",
    text: "This is the Command Rail. Select any agent → type a message or reminder → hit Send. The agent wakes up with your instruction as context. Their response or task completion appears below.",
  },
  { kind: "sent",    from: "You",    text: "Austin — where are we on the Pose contract redlines?",              ts: "9:01 AM" },
  { kind: "recv",    from: "Austin", text: "Counter-party sent edits last night. Reviewing now. Redlines back by noon.", ts: "9:03 AM" },
  { kind: "sent",    from: "You",    text: "Ping me the moment you're done. Also remind at 4pm if nothing yet.",  ts: "9:04 AM" },
  { kind: "system",  from: "System", text: "⏰ Reminder queued: Pose contract follow-up — 4:00 PM",              ts: "9:04 AM" },
  { kind: "recv",    from: "Austin", text: "Redlines sent. Flagging Syntax Capital LP clause — needs your eyes before signing. Created issue LFG-112.", ts: "11:58 AM" },
  { kind: "done",    from: "System", text: "✅ Task complete: Pose contract redlines — Austin",                  ts: "11:59 AM" },
  { kind: "sent",    from: "You",    text: "Egide — Ghana VASP filing still on track for Thursday?",             ts: "2:10 PM" },
  { kind: "recv",    from: "Egide",  text: "Confirmed. Docs staged. Waiting on one KYC doc from partner — following up now.", ts: "2:14 PM" },
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
//  Notion Panel
// ─────────────────────────────────────────────────────────────────────────────
const PRIORITY_COLOR: Record<string, string> = {
  Urgent: "#f87171", High: "#fbbf24", Medium: "#818cf8", Low: "#64748b", P1: "#f87171", P2: "#fbbf24", P3: "#818cf8",
};
const DEAL_STATUS_COLOR: Record<string, string> = {
  Yes: "#34d399", Active: "#34d399", "In Progress": "#fbbf24",
  "Dormant / Parked": "#374151", Dormant: "#374151",
};

type NotionTab = "tasks" | "goals" | "deals";

function NotionPanel() {
  const [tab, setTab] = useState<NotionTab>("tasks");
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.notion(),
    queryFn: () => notionApi.summary(),
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
    staleTime: 3 * 60 * 1000,
  });

  const TABS: [NotionTab, string, number | undefined][] = [
    ["tasks", "Tasks",  data?.tasks.length],
    ["goals", "Goals",  data?.goals.length],
    ["deals", "Deals",  data?.deals.filter(d => !d.status.toLowerCase().includes("dormant")).length],
  ];

  const lastSync = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="shrink-0 rounded-2xl overflow-hidden"
      style={{ background: "rgba(0,0,0,0.4)", border: `1px solid rgba(255,255,255,0.06)` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 18 18" width={14} height={14} fill="none">
            <rect x="1" y="1" width="16" height="16" rx="3" stroke={GOLD} strokeWidth="1.4" />
            <rect x="4" y="5" width="10" height="1.5" rx="0.75" fill={GOLD} fillOpacity="0.7" />
            <rect x="4" y="8.5" width="7" height="1.5" rx="0.75" fill={GOLD} fillOpacity="0.5" />
            <rect x="4" y="12" width="8" height="1.5" rx="0.75" fill={GOLD} fillOpacity="0.35" />
          </svg>
          <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD, fontFamily: "monospace" }}>
            Notion
          </span>
          {lastSync && (
            <span className="text-[8px] text-white/25 font-mono">synced {lastSync}</span>
          )}
        </div>
        <div className="flex gap-1">
          {TABS.map(([t, lbl, cnt]) => (
            <button key={t} onClick={() => setTab(t)}
              className="text-[9px] font-bold px-2.5 py-0.5 rounded-full transition-all"
              style={{
                background: tab === t ? `${GOLD}20` : "transparent",
                border: `1px solid ${tab === t ? GOLD + "40" : "transparent"}`,
                color: tab === t ? GOLD : "rgba(255,255,255,0.35)",
                fontFamily: "monospace",
              }}>
              {lbl}{cnt != null ? ` · ${cnt}` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[220px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}20 transparent` }}>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <span className="text-[10px] text-white/25 font-mono animate-pulse">Loading Notion…</span>
          </div>
        )}
        {error && (
          <div className="px-4 py-3 text-[10px] font-mono" style={{ color: "#f87171" }}>
            Notion unavailable — check API key config
          </div>
        )}
        {!isLoading && !error && data && (
          <>
            {tab === "tasks" && (
              data.tasks.length === 0
                ? <p className="text-[9px] text-white/20 font-mono px-4 py-3">No open tasks</p>
                : data.tasks.map((t: NotionTask) => {
                  const pc = PRIORITY_COLOR[t.priority] ?? "#64748b";
                  const lead = t.assignedTo?.[0] ?? t.assignee ?? null;
                  const hasBlocker = t.blockers && t.blockers.trim().length > 0;
                  const due = t.dueDate ? new Date(t.dueDate) : null;
                  const now = Date.now();
                  const isOverdue = due && due.getTime() < now;
                  const isDueSoon = due && !isOverdue && due.getTime() - now < 48 * 60 * 60 * 1000;
                  const dueColor = isOverdue ? "#f87171" : isDueSoon ? "#fbbf24" : "#64748b";
                  return (
                    <a key={t.id} href={t.url} target="_blank" rel="noreferrer" className="no-underline block">
                      <div className="flex flex-col gap-0.5 px-4 py-2.5 hover:bg-white/[0.025] transition-colors group"
                        style={{ borderBottom: hasBlocker ? "1px solid rgba(248,113,113,0.08)" : "1px solid transparent" }}>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: pc }} />
                          <span className="flex-1 text-[11px] text-white/75 group-hover:text-white/95 transition-colors truncate">
                            {t.name}
                          </span>
                          {t.priority && (
                            <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ color: pc, background: `${pc}12`, border: `1px solid ${pc}25`, fontFamily: "monospace" }}>
                              {t.priority.toUpperCase()}
                            </span>
                          )}
                        </div>
                        {(lead || due || hasBlocker) && (
                          <div className="flex items-center gap-3 pl-3.5">
                            {lead && (
                              <span className="text-[9px] font-bold font-mono" style={{ color: GOLD + "99" }}>
                                👤 {lead}
                              </span>
                            )}
                            {due && (
                              <span className="text-[9px] font-mono font-bold" style={{ color: dueColor }}>
                                {isOverdue ? "⚠ OVERDUE" : `📅 ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                              </span>
                            )}
                            {hasBlocker && (
                              <span className="text-[9px] font-mono truncate max-w-[120px]" style={{ color: "#f87171" }}>
                                🚧 {t.blockers}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })
            )}
            {tab === "goals" && (
              data.goals.length === 0
                ? <p className="text-[9px] text-white/20 font-mono px-4 py-3">No goals found</p>
                : data.goals.map((g: NotionGoal) => (
                  <a key={g.id} href={g.url} target="_blank" rel="noreferrer" className="no-underline block">
                    <div className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.025] transition-colors group">
                      <span className="flex-1 text-[11px] text-white/70 group-hover:text-white/90 transition-colors truncate">
                        {g.name}
                      </span>
                      {g.status && (
                        <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ color: PRIORITY_COLOR[g.status] ?? GOLD, background: `${PRIORITY_COLOR[g.status] ?? GOLD}12`, border: `1px solid ${PRIORITY_COLOR[g.status] ?? GOLD}25`, fontFamily: "monospace" }}>
                          {g.status.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </a>
                ))
            )}
            {tab === "deals" && (
              data.deals.length === 0
                ? <p className="text-[9px] text-white/20 font-mono px-4 py-3">No deals found</p>
                : data.deals.map((d: NotionDeal) => {
                  const c = DEAL_STATUS_COLOR[d.status] ?? "#64748b";
                  return (
                    <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="no-underline block">
                      <div className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/[0.025] transition-colors group">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                        <span className="flex-1 text-[11px] text-white/70 group-hover:text-white/90 transition-colors truncate">
                          {d.name}
                        </span>
                        <span className="text-[8px] font-mono shrink-0" style={{ color: c + "99" }}>
                          {d.status}
                        </span>
                      </div>
                    </a>
                  );
                })
            )}
          </>
        )}
      </div>
    </div>
  );
}

type CmdMessage = { from: string; text: string; ts: string; kind: "sent" | "recv" | "system" | "done" | "ping" | "remind" };

const MODEL_OPTIONS = [
  { label: "Gemini 3.1 Pro",       value: "google/gemini-3.1-pro-preview-customtools" },
  { label: "Gemini 3.1 Flash",     value: "google/gemini-3.1-flash-preview" },
  { label: "Sonnet 4.6",           value: "openrouter/anthropic/claude-sonnet-4.6" },
  { label: "GPT-5.4",              value: "openrouter/openai/gpt-5.4" },
  { label: "Kimi K2.5",            value: "openrouter/moonshotai/kimi-k2.5" },
  { label: "Opus 4.6",             value: "openrouter/anthropic/claude-opus-4.6" },
  { label: "Gemini 3 Flash",       value: "google/gemini-3-flash-preview" },
  { label: "Gemini 3 Pro",         value: "google/gemini-3-pro-preview" },
];

function ModelSwitcherPanel({ agents, companyId }: { agents: Agent[]; companyId: string }) {
  const { pushToast } = useToast();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const switchModel = async (agent: Agent, model: string) => {
    setPending(agent.id + model);
    try {
      await agentsApi.update(agent.id, { model }, companyId);
      pushToast({ title: `${agent.name.replace(/\s*Agent\s*$/i, "")} → ${MODEL_OPTIONS.find(m => m.value === model)?.label ?? model}`, tone: "success" });
      qc.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
    } catch {
      pushToast({ title: "Model switch failed", tone: "error" });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5" style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}20 transparent` }}>
      <div className="text-[9px] font-black tracking-widest text-white/25 font-mono px-1 mb-1">
        AGENT MODELS — click to switch
      </div>
      {agents.map(agent => {
        const color = STATUS_COLOR[agent.status] ?? "#6b7280";
        const currentModel = (agent as any).model as string | undefined;
        return (
          <div key={agent.id} className="rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[10px] font-black text-white/75 font-mono flex-1 truncate">
                {agent.name.replace(/\s*Agent\s*$/i, "")}
              </span>
              {currentModel && (
                <span className="text-[8px] text-white/30 font-mono truncate max-w-[90px]">
                  {MODEL_OPTIONS.find(m => m.value === currentModel)?.label ?? currentModel.split("/").pop()}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 p-2">
              {MODEL_OPTIONS.map(opt => {
                const isActive = currentModel === opt.value;
                const isLoading = pending === agent.id + opt.value;
                return (
                  <button key={opt.value}
                    onClick={() => switchModel(agent, opt.value)}
                    disabled={isActive || !!pending}
                    className="text-[8px] font-bold px-2 py-0.5 rounded-full transition-all hover:scale-105 disabled:cursor-default"
                    style={{
                      background: isActive ? `${color}20` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isActive ? color + "40" : "rgba(255,255,255,0.08)"}`,
                      color: isActive ? color : isLoading ? GOLD : "rgba(255,255,255,0.4)",
                      fontFamily: "monospace",
                    }}>
                    {isLoading ? "…" : opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
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
  const [msgType, setMsgType] = useState<"message" | "ping" | "remind">("message");
  const [sentLog, setSentLog] = useState<CmdMessage[]>([]);
  const { pushToast } = useToast();
  const qc = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const wakeup = useMutation({
    mutationFn: ({ reason, agentId }: { reason: string; agentId: string }) =>
      agentsApi.wakeup(agentId, { source: "on_demand", triggerDetail: "manual", reason }, companyId),
    onSuccess: (_, vars) => {
      const name = selectedAgent?.name.replace(/\s*Agent\s*$/i, "") ?? "Agent";
      pushToast({ title: `Sent to ${name}`, tone: "success" });
      qc.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
      setSentLog(prev => [...prev, {
        kind: msgType === "ping" ? "ping" : msgType === "remind" ? "remind" : "sent",
        from: "You",
        text: vars.reason,
        ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
      setMsg("");
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    onError: () => pushToast({ title: "Failed to send", tone: "error" }),
  });

  const handleSend = () => {
    if (!msg.trim() || !selectedAgent) return;
    const prefix = msgType === "ping" ? "🔔 PING: " : msgType === "remind" ? "⏰ REMIND: " : "";
    wakeup.mutate({ reason: prefix + msg.trim(), agentId: selectedAgent.id });
  };

  const teamAgents = agents.filter(isTeamAgent);
  const agentColor = selectedAgent ? (STATUS_COLOR[selectedAgent.status] ?? "#6b7280") : GOLD;

  const TABS: [CmdTab, string][] = [["compose", "Message"], ["models", "Models"], ["example", "How it works"]];

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden h-full"
      style={{ background: "rgba(8,7,14,0.95)", border: `1px solid ${GOLD}20` }}>

      {/* Header */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" style={{ color: GOLD }} />
            <span className="text-[12px] font-black tracking-widest uppercase" style={{ color: GOLD, fontFamily: "monospace" }}>
              {selectedAgent ? selectedAgent.name.replace(/\s*Agent\s*$/i, "") : "Command Rail"}
            </span>
          </div>
          {selectedAgent && (
            <span className="text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full"
              style={{ color: agentColor, background: `${agentColor}15`, border: `1px solid ${agentColor}28`, fontFamily: "monospace" }}>
              {STATUS_LABEL[selectedAgent.status] ?? selectedAgent.status.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {TABS.map(([t, lbl]) => (
            <button key={t} onClick={() => setTab(t)}
              className="text-[9px] font-bold px-3 py-1 rounded-full transition-all"
              style={{
                background: tab === t ? `${GOLD}20` : "transparent",
                color: tab === t ? GOLD : "rgba(255,255,255,0.3)",
                border: `1px solid ${tab === t ? GOLD + "40" : "transparent"}`,
                fontFamily: "monospace",
              }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {tab === "models" ? (
        <ModelSwitcherPanel agents={teamAgents} companyId={companyId} />
      ) : tab === "example" ? (
        /* ── How it works ── */
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}30 transparent` }}>
          {EXAMPLE_THREAD.map((m, i) => {
            if (m.kind === "intro") return (
              <div key={i} className="px-3 py-2.5 rounded-xl text-[10px] leading-relaxed mb-3"
                style={{ background: `${GOLD}0a`, border: `1px solid ${GOLD}1a`, color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
                💡 {m.text}
              </div>
            );
            const isSent = m.kind === "sent";
            const isSys  = m.kind === "system" || m.kind === "done";
            return (
              <div key={i} className={`flex flex-col gap-0.5 ${isSent ? "items-end" : isSys ? "items-center" : "items-start"}`}>
                {!isSys && (
                  <span className="text-[8px] font-bold px-1"
                    style={{ color: isSent ? GOLD + "88" : "rgba(255,255,255,0.28)", fontFamily: "monospace" }}>
                    {m.from} · {m.ts}
                  </span>
                )}
                <div className="max-w-[88%] px-3 py-2 rounded-2xl text-[10px] leading-relaxed"
                  style={{
                    background: isSent ? `linear-gradient(135deg, ${GOLD}22, ${GOLD}12)` :
                      m.kind === "done" ? "rgba(52,211,153,0.08)" :
                      isSys ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.05)",
                    border: isSent ? `1px solid ${GOLD}30` :
                      m.kind === "done" ? "1px solid rgba(52,211,153,0.2)" :
                      isSys ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.08)",
                    color: isSent ? "rgba(255,255,255,0.88)" :
                      m.kind === "done" ? "#34d399" :
                      isSys ? "#a78bfa" : "rgba(255,255,255,0.7)",
                    fontFamily: isSys ? "monospace" : undefined,
                    fontSize: isSys ? "9px" : undefined,
                  }}>
                  {m.text}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Compose ── */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Agent chips */}
          <div className="px-3 pt-2.5 pb-2 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="text-[8px] font-black tracking-widest uppercase mb-1.5" style={{ color: "rgba(255,255,255,0.22)", fontFamily: "monospace" }}>
              Select agent
            </div>
            <div className="flex flex-wrap gap-1">
              {teamAgents.map(a => {
                const active = selectedAgent?.id === a.id;
                const c = STATUS_COLOR[a.status] ?? "#6b7280";
                return (
                  <button key={a.id} onClick={() => onSelectAgent(active ? null : a)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold transition-all"
                    style={{
                      background: active ? `${c}20` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? c + "45" : "rgba(255,255,255,0.08)"}`,
                      color: active ? c : "rgba(255,255,255,0.38)",
                      fontFamily: "monospace",
                    }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                    {a.name.replace(/\s*Agent\s*$/i, "")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Thread */}
          <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2" style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}20 transparent` }}>
            {sentLog.length === 0 && !selectedAgent && (
              <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
                <MessageSquare className="h-7 w-7" style={{ color: GOLD + "35" }} />
                <p className="text-[10px] text-white/18 font-mono text-center leading-relaxed">
                  Pick an agent above.<br />Message, ping, or set a reminder.
                </p>
              </div>
            )}
            {selectedAgent && sentLog.length === 0 && (
              <div className="px-3 py-2.5 rounded-xl text-[10px] leading-relaxed"
                style={{ background: `${agentColor}08`, border: `1px solid ${agentColor}18`, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>
                Talking to <span style={{ color: agentColor }}>{selectedAgent.name.replace(/\s*Agent\s*$/i, "")}</span>. Your message wakes them with your instruction as context. Responses appear in their next heartbeat.
              </div>
            )}
            {sentLog.map((m, i) => (
              <div key={i} className="flex flex-col gap-0.5 items-end">
                <span className="text-[8px] font-bold px-1" style={{ color: GOLD + "77", fontFamily: "monospace" }}>
                  {m.kind === "ping" ? "🔔 Ping" : m.kind === "remind" ? "⏰ Remind" : "Message"} · {m.ts}
                </span>
                <div className="max-w-[88%] px-3 py-2 rounded-2xl text-[10px] leading-relaxed"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}20, ${GOLD}10)`,
                    border: `1px solid ${GOLD}28`,
                    color: "rgba(255,255,255,0.85)",
                  }}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message type toggle */}
          <div className="px-3 pt-2 shrink-0">
            <div className="flex gap-1 mb-2">
              {(["message", "ping", "remind"] as const).map(t => (
                <button key={t} onClick={() => setMsgType(t)}
                  className="text-[8px] font-black tracking-widest px-2.5 py-1 rounded-full transition-all"
                  style={{
                    background: msgType === t ? `${GOLD}20` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${msgType === t ? GOLD + "40" : "rgba(255,255,255,0.08)"}`,
                    color: msgType === t ? GOLD : "rgba(255,255,255,0.3)",
                    fontFamily: "monospace",
                  }}>
                  {t === "message" ? "💬 MSG" : t === "ping" ? "🔔 PING" : "⏰ REMIND"}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-3 pb-3 shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={
                  !selectedAgent ? "Select an agent first…" :
                  msgType === "ping" ? `Ping ${selectedAgent.name.replace(/\s*Agent\s*$/i, "")} with a note…` :
                  msgType === "remind" ? "Set a reminder (e.g. follow up on X by 4pm)…" :
                  `Message ${selectedAgent.name.replace(/\s*Agent\s*$/i, "")}…`
                }
                disabled={!selectedAgent || wakeup.isPending}
                rows={2}
                className="flex-1 resize-none rounded-xl px-3 py-2 text-[11px] outline-none transition-all disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${selectedAgent ? GOLD + "30" : "rgba(255,255,255,0.07)"}`,
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: "monospace",
                  scrollbarWidth: "none",
                }}
              />
              <button
                onClick={handleSend}
                disabled={!selectedAgent || !msg.trim() || wakeup.isPending}
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-all disabled:opacity-30 hover:scale-105 active:scale-95"
                style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}40`, color: GOLD }}
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

  // Viewer identity — persisted across sessions
  const [viewerId, setViewerIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(VIEWER_KEY) ?? null; } catch { return null; }
  });
  const setViewerId = (id: string | null) => {
    setViewerIdState(id);
    try {
      if (id) localStorage.setItem(VIEWER_KEY, id);
      else localStorage.removeItem(VIEWER_KEY);
    } catch { /* ignore */ }
  };

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

  const { data: notionData } = useQuery({
    queryKey: queryKeys.notion(),
    queryFn: () => notionApi.summary(),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
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
  const allAgents     = agents ?? [];
  const totalAgents   = allAgents.length;
  const runningAgents = allAgents.filter(a => a.status === "running" || a.status === "idle").length;
  const activity      = useMemo(() => (activityRaw ?? []).slice(0, 50), [activityRaw]);

  // Tasks split: human (assigneeUserId set, no agent) vs agent
  const allOpen = useMemo(() =>
    (issues ?? []).filter(i => i.status !== "done" && i.status !== "cancelled" && i.status !== "backlog"),
    [issues]
  );
  // Only show issues active/updated in last 24h or status is in_progress/blocked
  const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const isUrgent = (i: typeof allOpen[0]) =>
    i.status === "in_progress" || i.status === "blocked" ||
    new Date(i.updatedAt).getTime() > recentCutoff;
  const humanTasks = useMemo(() => allOpen.filter(i => (!!i.assigneeUserId && !i.assigneeAgentId) && isUrgent(i)).slice(0, 6), [allOpen]);
  const agentTasks = useMemo(() => allOpen.filter(i => !!i.assigneeAgentId && isUrgent(i)).slice(0, 6), [allOpen]);
  const unassignedTasks = useMemo(() => allOpen.filter(i => !i.assigneeUserId && !i.assigneeAgentId && isUrgent(i)).slice(0, 4), [allOpen]);

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
      <TopBar
        totalAgents={totalAgents} runningAgents={runningAgents}
        teamAgents={teamAgents} viewerId={viewerId} onViewerChange={setViewerId}
      />

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

      {/* ── Body: Main | Command Rail ── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* ── MAIN AREA (scrollable) ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto pb-4"
          style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}22 transparent` }}>

          {/* ── ROW 1: Notion Tasks | Open Tasks + Bottlenecks ── */}
          <div className="grid grid-cols-2 gap-3 shrink-0">

            {/* ── NOTION TASKS panel (rich cards) ── */}
            <div className="rounded-2xl overflow-hidden flex flex-col"
              style={{ background: "rgba(0,0,0,0.45)", border: `1px solid ${GOLD}22` }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
                style={{ borderBottom: `1px solid ${GOLD}18`, background: `linear-gradient(90deg, ${GOLD}08 0%, transparent 60%)` }}>
                <div className="flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
                    <rect x="0.5" y="0.5" width="11" height="11" rx="2" fill="none" stroke={GOLD} strokeWidth="1.2" strokeOpacity="0.7"/>
                    <rect x="2.5" y="4" width="7" height="1.2" rx="0.6" fill={GOLD} fillOpacity="0.55"/>
                    <rect x="2.5" y="6.5" width="5" height="1.2" rx="0.6" fill={GOLD} fillOpacity="0.35"/>
                  </svg>
                  <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD, fontFamily: "monospace" }}>
                    Notion
                  </span>
                  {notionData && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold font-mono"
                      style={{ background: GOLD + "18", color: GOLD + "bb" }}>
                      {notionData.tasks.length} open
                    </span>
                  )}
                </div>
                {notionData && (
                  <span className="text-[8px] font-mono text-white/20">
                    synced {new Date(notionData.fetchedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              {/* Task cards */}
              <div className="flex-1 overflow-y-auto pt-2 pb-1"
                style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}22 transparent` }}>
                {!notionData ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-[9px] font-mono text-white/20 animate-pulse">Loading Notion...</span>
                  </div>
                ) : notionData.tasks.length === 0 ? (
                  <p className="text-[9px] text-white/20 font-mono px-4 py-3">No open tasks</p>
                ) : (
                  notionData.tasks.map((t: NotionTask) => <NotionTaskCard key={t.id} task={t} />)
                )}
              </div>
              {/* Footer tabs for Goals/Deals */}
              {notionData && (
                <div className="flex items-center gap-3 px-4 py-2 shrink-0"
                  style={{ borderTop: `1px solid rgba(255,255,255,0.05)` }}>
                  <a href="https://notion.so" target="_blank" rel="noreferrer"
                    className="text-[9px] font-mono hover:opacity-80 transition-opacity no-underline"
                    style={{ color: GOLD + "66" }}>
                    {notionData.goals.length} goals · {notionData.deals.length} deals →
                  </a>
                </div>
              )}
            </div>

            {/* ── RIGHT OF ROW 1: Tasks + Bottlenecks stacked ── */}
            <div className="flex flex-col gap-3">

              {/* Open Tasks — human / agent split */}
              <div className="rounded-2xl overflow-hidden"
                style={{ background: "rgba(0,0,0,0.4)", border: `1px solid rgba(255,255,255,0.07)` }}>
                <div className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: GOLD }} />
                    <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD, fontFamily: "monospace" }}>
                      Open Tasks
                    </span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold font-mono"
                      style={{ background: GOLD + "18", color: GOLD + "bb" }}>
                      {allOpen.length}
                    </span>
                    <span className="text-[8px] font-mono text-white/25 ml-1">24h</span>
                  </div>
                  <Link to="/issues" className="text-[9px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity"
                    style={{ color: GOLD + "99" }}>All →</Link>
                </div>
                <div className="grid grid-cols-2 divide-x divide-white/[0.04]">
                  {/* Human tasks */}
                  <div className="py-1">
                    <div className="px-3 py-1.5">
                      <span className="text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full"
                        style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", fontFamily: "monospace" }}>
                        👤 Human
                      </span>
                    </div>
                    {humanTasks.length === 0 && unassignedTasks.length === 0 ? (
                      <p className="text-[9px] text-white/20 font-mono px-3 pb-2">None due</p>
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
                    <div className="px-3 py-1.5">
                      <span className="text-[8px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full"
                        style={{ color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", fontFamily: "monospace" }}>
                        🤖 Agent
                      </span>
                    </div>
                    {agentTasks.length === 0 ? (
                      <p className="text-[9px] text-white/20 font-mono px-3 pb-2">None active</p>
                    ) : (
                      agentTasks.map(issue => (
                        <TaskRow key={issue.id} id={issue.id} title={issue.title} status={issue.status}
                          assignee={agentShortName(issue.assigneeAgentId)} />
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bottlenecks */}
              <BottlenecksPanel issues={bottleneckTasks} agentMap={agentMap} companyId={selectedCompanyId ?? ""} />

            </div>
          </div>

          {/* ── ROW 2: Team Grid (full width) ── */}
          <div className="shrink-0 rounded-2xl overflow-hidden"
            style={{ background: "rgba(0,0,0,0.3)", border: `1px solid rgba(255,255,255,0.06)` }}>
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5" style={{ color: GOLD }} />
                <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: GOLD, fontFamily: "monospace" }}>
                  Team
                </span>
                <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold font-mono"
                  style={{ background: GOLD + "18", color: GOLD + "bb" }}>
                  {teamAgents.length}
                </span>
              </div>
              <Link to="/agents" className="text-[9px] font-bold tracking-widest uppercase hover:opacity-70 transition-opacity"
                style={{ color: GOLD + "99" }}>
                All Agents →
              </Link>
            </div>
            <div className="px-4 py-3">
              {teamAgents.length === 0 ? (
                <p className="text-[10px] text-white/25 font-mono py-4 text-center">No team agents</p>
              ) : (
                <TeamGrid agents={teamAgents} onPing={setSelectedAgent} viewerAgent={teamAgents.find(a => a.id === viewerId) ?? null} />
              )}
            </div>
          </div>

          {/* ── ROW 3: Activity Feed ── */}
          <div className="rounded-2xl overflow-hidden flex flex-col min-h-[160px]"
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
            <div className="overflow-y-auto px-2 py-1 max-h-[220px]" style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}22 transparent` }}>
              {activity.length === 0 ? (
                <p className="text-[10px] text-white/25 font-mono text-center py-6">No activity yet</p>
              ) : (
                <div className="space-y-0.5">
                  {activity.slice(0, 20).map(ev => (
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
