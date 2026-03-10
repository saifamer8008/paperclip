/**
 * AgentOffice — 2D pixel-art office floor.
 * Renders a tiled office room with desks, monitors, chairs, plants, and
 * coloured agent "presence dots" that slowly drift around their desk.
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "@/lib/router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/context/ToastContext";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import type { Agent } from "@paperclipai/shared";
import { Zap, ExternalLink, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── palette ────────────────────────────────────────────────────────────────
const GOLD   = "#C9A84C";
const GRID_BG = "rgba(0,0,0,0)";

const STATUS_COLOR: Record<string, string> = {
  running:          "#34d399",
  idle:             "#818cf8",
  error:            "#f87171",
  paused:           "#fbbf24",
  pending_approval: "#fb923c",
  terminated:       "#374151",
};

// ─── agent role/palette by name ─────────────────────────────────────────────
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
  { desk: "#1e1b4b", monitor: "#312e81", accent: "#818cf8" }, // indigo
  { desk: "#064e3b", monitor: "#065f46", accent: "#34d399" }, // emerald
  { desk: "#451a03", monitor: "#78350f", accent: "#fb923c" }, // orange
  { desk: "#0c4a6e", monitor: "#075985", accent: "#38bdf8" }, // sky
  { desk: "#3b0764", monitor: "#4a044e", accent: "#c084fc" }, // purple
  { desk: "#450a0a", monitor: "#7f1d1d", accent: "#f87171" }, // red
  { desk: "#14532d", monitor: "#166534", accent: "#86efac" }, // green
  { desk: "#1e1b4b", monitor: "#2d2a70", accent: "#a78bfa" }, // violet
];

function getPalette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return PALETTES[h % PALETTES.length];
}

// ─── desk cell ──────────────────────────────────────────────────────────────
const DESK_W = 152;
const DESK_H = 160;

interface DeskAgent { agent: Agent; pal: ReturnType<typeof getPalette>; }

function useHeartbeatTrigger(agentId: string, agentName: string, companyId: string) {
  const { pushToast } = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/agents/${agentId}/heartbeat/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-paperclip-company-id": companyId, "x-paperclip-local-trusted": "true" },
        body: JSON.stringify({ source: "on_demand", triggerDetail: "manual" }),
      });
      if (!r.ok) throw new Error(await r.text() || "Failed");
      return r.json();
    },
    onSuccess: () => {
      pushToast({ title: `${agentName} triggered`, tone: "success" });
      qc.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId, agentId) });
      qc.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
    },
    onError: (e) => pushToast({ title: "Trigger failed", body: e instanceof Error ? e.message : "Unknown", tone: "error" }),
  });
}

/** Animated presence dot that drifts within a ±4px radius */
function PresenceDot({ color, isRunning }: { color: string; isRunning: boolean }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => {
      setPos({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8 });
    }, 1200);
    return () => clearInterval(t);
  }, [isRunning]);

  return (
    <motion.div
      animate={pos}
      transition={{ duration: 1.0, ease: "easeInOut" }}
      className="relative"
    >
      <div
        className="w-4 h-4 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}, 0 0 16px ${color}55` }}
      />
      {isRunning && (
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: color, opacity: 0.35 }}
        />
      )}
    </motion.div>
  );
}

/** One desk cell: pixel-art monitor + desk + presence dot */
function DeskCell({ agent, pal, companyId }: DeskAgent & { companyId: string }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const trigger = useHeartbeatTrigger(agent.id, agent.name, companyId);
  const color = STATUS_COLOR[agent.status ?? "idle"] ?? "#6b7280";
  const isRunning = agent.status === "running";
  const shortName = agent.name.replace(" Agent", "");
  const role = getRole(agent.name);

  // scanline animation state for running monitor
  const [scanY, setScanY] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => setScanY((y) => (y + 2) % 42), 60);
    return () => clearInterval(t);
  }, [isRunning]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex flex-col items-center gap-1 cursor-pointer select-none"
      style={{ width: DESK_W, minHeight: DESK_H }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/agents/${agent.urlKey ?? agent.id}`)}
    >
      {/* Desk SVG */}
      <svg viewBox="0 0 120 108" width={120} height={108} xmlns="http://www.w3.org/2000/svg">
        {/* desk surface */}
        <rect x="8" y="52" width="104" height="44" rx="4" fill={pal.desk} />
        <rect x="8" y="52" width="104" height="6" rx="3" fill={pal.monitor} opacity="0.6" />

        {/* desk legs */}
        <rect x="16" y="90" width="6" height="18" rx="2" fill={pal.desk} opacity="0.7" />
        <rect x="98" y="90" width="6" height="18" rx="2" fill={pal.desk} opacity="0.7" />

        {/* monitor stand */}
        <rect x="55" y="34" width="10" height="20" rx="2" fill={pal.monitor} />
        <rect x="45" y="50" width="30" height="4" rx="2" fill={pal.monitor} opacity="0.5" />

        {/* monitor screen */}
        <rect x="28" y="8" width="64" height="42" rx="4" fill={pal.monitor} />
        <rect x="30" y="10" width="60" height="38" rx="3" fill="#0a0a1a" />

        {/* screen content */}
        {isRunning ? (
          <>
            {/* terminal lines */}
            {[0, 1, 2, 3, 4].map((i) => (
              <rect
                key={i}
                x="33"
                y={13 + i * 6}
                width={12 + (i * 7) % 38}
                height="2"
                rx="1"
                fill={pal.accent}
                opacity={0.7 - i * 0.1}
              />
            ))}
            {/* scan line */}
            <rect x="30" y={10 + (scanY % 38)} width="60" height="2" rx="1" fill={pal.accent} opacity="0.12" />
            {/* cursor blink */}
            <rect x="33" y="41" width="5" height="4" rx="0.5" fill={pal.accent} opacity={Math.sin(Date.now() / 400) > 0 ? 0.9 : 0} />
          </>
        ) : agent.status === "error" ? (
          <>
            <text x="60" y="36" textAnchor="middle" fontSize="18" fill="#f87171">!</text>
          </>
        ) : (
          <>
            {/* idle: dim screensaver lines */}
            {[0, 1, 2].map((i) => (
              <rect key={i} x="33" y={16 + i * 8} width={20 + i * 8} height="1.5" rx="1" fill={pal.accent} opacity="0.2" />
            ))}
            <rect x="33" y="38" width="30" height="1.5" rx="1" fill={pal.accent} opacity="0.1" />
          </>
        )}

        {/* keyboard */}
        <rect x="20" y="62" width="80" height="20" rx="3" fill={pal.monitor} opacity="0.5" />
        {[0,1,2,3,4].map((row) =>
          [0,1,2,3,4,5,6].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={22 + col * 11}
              y={64 + row * 3.5}
              width={9}
              height={2.5}
              rx="0.5"
              fill={pal.accent}
              opacity="0.18"
            />
          ))
        )}

        {/* mouse */}
        <ellipse cx="104" cy="68" rx="6" ry="8" fill={pal.monitor} opacity="0.55" />
        <rect x="103" y="62" width="2" height="5" rx="1" fill={pal.accent} opacity="0.3" />

        {/* status lamp */}
        <circle cx="86" cy="14" r="3" fill={color} opacity="0.9" />
        {isRunning && <circle cx="86" cy="14" r="5" fill={color} opacity="0.25" />}

        {/* coffee mug */}
        <rect x="92" y="58" width="10" height="12" rx="2" fill="#6b4c35" opacity="0.7" />
        <path d="M102,62 Q108,62 108,68 Q108,74 102,74" fill="none" stroke="#6b4c35" strokeWidth="1.5" opacity="0.5" />
        <rect x="93" y="59" width="8" height="3" rx="1" fill="#34d399" opacity="0.25" />
      </svg>

      {/* Presence dot above desk */}
      <div className="absolute" style={{ top: -4, left: "50%", transform: "translateX(-50%)" }}>
        <PresenceDot color={color} isRunning={isRunning} />
      </div>

      {/* Name + role */}
      <div className="text-center leading-tight px-1">
        <div className="text-xs font-bold text-white/90 truncate w-full" style={{ fontFamily: "monospace" }}>
          {shortName}
        </div>
        <div className="text-[10px] font-medium truncate" style={{ color: pal.accent, fontFamily: "monospace" }}>
          {role}
        </div>
      </div>

      {/* Hover action bar */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-b-lg"
            style={{ background: `linear-gradient(to top, rgba(0,0,0,0.85), transparent)` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); trigger.mutate(); }}
              disabled={trigger.isPending}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase transition-all disabled:opacity-50"
              style={{ background: `${pal.accent}22`, color: pal.accent, border: `1px solid ${pal.accent}44` }}
            >
              {trigger.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Zap className="h-2.5 w-2.5" />}
              RUN
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/agents/${agent.urlKey ?? agent.id}`); }}
              className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <ExternalLink className="h-2.5 w-2.5" />
              VIEW
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── floor room ─────────────────────────────────────────────────────────────

/** A decorative plant in the corner */
function OfficePlant({ x, y }: { x: number; y: number }) {
  return (
    <svg viewBox="0 0 40 50" width={40} height={50} style={{ position: "absolute", left: x, top: y }} xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="36" width="12" height="14" rx="2" fill="#5c3d2e" opacity="0.6" />
      <ellipse cx="20" cy="28" rx="14" ry="16" fill="#166534" opacity="0.7" />
      <ellipse cx="12" cy="20" rx="8" ry="10" fill="#15803d" opacity="0.6" />
      <ellipse cx="28" cy="22" rx="8" ry="10" fill="#15803d" opacity="0.6" />
    </svg>
  );
}

/** Floor tile pattern */
function FloorTiles({ w, h }: { w: number; h: number }) {
  const tileSize = 32;
  const cols = Math.ceil(w / tileSize) + 1;
  const rows = Math.ceil(h / tileSize) + 1;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="floor-tile" x="0" y="0" width={tileSize} height={tileSize} patternUnits="userSpaceOnUse">
          <rect width={tileSize} height={tileSize} fill="rgba(255,255,255,0.015)" />
          <rect width={tileSize} height={tileSize} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#floor-tile)" />
    </svg>
  );
}

// ─── legend ──────────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { color: "#34d399", label: "Working" },
  { color: "#818cf8", label: "Standby" },
  { color: "#fbbf24", label: "Paused"  },
  { color: "#f87171", label: "Error"   },
];

// ─── main component ──────────────────────────────────────────────────────────

const STATUS_ORDER = ["running", "error", "paused", "idle", "pending_approval", "terminated"];

export const AgentOffice = React.memo(function AgentOffice({ agents }: { agents: Agent[] | undefined }) {
  const { selectedCompanyId } = useCompany();

  const sorted = useMemo(() =>
    [...(agents ?? [])].sort((a, b) =>
      (STATUS_ORDER.indexOf(a.status) ?? 99) - (STATUS_ORDER.indexOf(b.status) ?? 99)
    ),
  [agents]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
    ro.observe(el);
    setContainerW(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  if (!selectedCompanyId) return null;

  // Determine columns from container width
  const cols = Math.max(2, Math.min(sorted.length, Math.floor((containerW - 16) / (DESK_W + 12))));
  const rows = Math.ceil(sorted.length / cols);
  const floorH = rows * (DESK_H + 28) + 48;

  return (
    <div className="flex flex-col gap-2">
      {/* legend */}
      <div className="flex items-center gap-4 px-1">
        {LEGEND_ITEMS.map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
            {label}
          </span>
        ))}
      </div>

      {/* floor container */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg, oklch(0.10 0.005 260) 0%, oklch(0.07 0.005 260) 100%)",
          border: `1px solid ${GOLD}22`,
          minHeight: floorH,
        }}
      >
        {/* floor tiles */}
        <FloorTiles w={containerW} h={floorH} />

        {/* decorative plants */}
        <OfficePlant x={4} y={4} />
        <OfficePlant x={containerW - 48} y={4} />

        {/* room label */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 text-[9px] font-black tracking-[0.3em] uppercase px-3 py-1 rounded"
          style={{
            color: `${GOLD}88`,
            background: "rgba(0,0,0,0.3)",
            border: `1px solid ${GOLD}22`,
            fontFamily: "monospace",
          }}
        >
          ◈ LFG OPERATIONS FLOOR
        </div>

        {/* desks grid */}
        <div
          className="relative flex flex-wrap gap-3 p-4 pt-10 justify-start"
        >
          {sorted.map((agent) => (
            <DeskCell
              key={agent.id}
              agent={agent}
              pal={getPalette(agent.name)}
              companyId={selectedCompanyId}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
