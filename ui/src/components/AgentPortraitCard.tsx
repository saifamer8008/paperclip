import React, { useState } from "react";
import { useNavigate } from "@/lib/router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import type { Agent } from "@paperclipai/shared";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Loader2, ExternalLink } from "lucide-react";

// ── Agent role subtitles
const AGENT_ROLES: Record<string, string> = {
  "egide":    "The Operator",
  "maureen":  "The Coordinator",
  "austin":   "The Strategist",
  "action":   "The Comms Lead",
  "emmanuel": "The Field Agent",
  "sohaib":   "The Engineer",
  "razor":    "The Intelligence",
  "francis":  "The Chairman",
  "michal":   "The Analyst",
  "coding":   "The Builder",
  "comms":    "The Voice",
  "strategy": "The Planner",
  "drafts":   "The Writer",
  "research": "The Scout",
};

function getRole(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, role] of Object.entries(AGENT_ROLES)) {
    if (lower.includes(key)) return role;
  }
  return "The Agent";
}

// ── Color palettes per agent (hash by first char)
const PALETTES = [
  { bg: ["#0f172a", "#1e1b4b"], accent: "#818cf8", glow: "rgba(99,102,241,0.35)" },   // indigo
  { bg: ["#0c1a12", "#064e3b"], accent: "#34d399", glow: "rgba(52,211,153,0.35)" },   // emerald
  { bg: ["#1c0a00", "#451a03"], accent: "#fb923c", glow: "rgba(251,146,60,0.35)" },   // orange
  { bg: ["#0d1117", "#1e3a5f"], accent: "#38bdf8", glow: "rgba(56,189,248,0.35)" },   // sky
  { bg: ["#1a0a2e", "#3b0764"], accent: "#c084fc", glow: "rgba(192,132,252,0.35)" },  // purple
  { bg: ["#1a0a0a", "#450a0a"], accent: "#f87171", glow: "rgba(248,113,113,0.35)" },  // red
  { bg: ["#0a1a0a", "#14532d"], accent: "#86efac", glow: "rgba(134,239,172,0.35)" },  // green
  { bg: ["#0a0a1a", "#1e1b4b"], accent: "#a78bfa", glow: "rgba(167,139,250,0.35)" },  // violet
];

function getPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff;
  return PALETTES[hash % PALETTES.length];
}

// ── SVG portrait (stylised human silhouette, unique hair/feature per agent)
function AgentPortrait({
  name,
  accent,
  status,
  size = 120,
}: {
  name: string;
  accent: string;
  status: string;
  size?: number;
}) {
  const initial = name.charAt(0).toUpperCase();
  // derive a face variation from name length + char codes
  const seed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hairStyle = seed % 4;  // 0=short, 1=mid, 2=long, 3=shaved
  const isRunning = status === "running";

  // hair paths
  const hairPaths = [
    // short
    `M${size*0.3},${size*0.28} Q${size*0.5},${size*0.12} ${size*0.7},${size*0.28} L${size*0.68},${size*0.38} Q${size*0.5},${size*0.26} ${size*0.32},${size*0.38} Z`,
    // medium
    `M${size*0.28},${size*0.32} Q${size*0.5},${size*0.10} ${size*0.72},${size*0.32} L${size*0.70},${size*0.55} Q${size*0.65},${size*0.48} ${size*0.5},${size*0.45} Q${size*0.35},${size*0.48} ${size*0.30},${size*0.55} Z`,
    // long
    `M${size*0.26},${size*0.30} Q${size*0.5},${size*0.08} ${size*0.74},${size*0.30} L${size*0.74},${size*0.72} Q${size*0.65},${size*0.60} ${size*0.5},${size*0.58} Q${size*0.35},${size*0.60} ${size*0.26},${size*0.72} Z`,
    // tight/undercut
    `M${size*0.32},${size*0.30} Q${size*0.5},${size*0.14} ${size*0.68},${size*0.30} L${size*0.66},${size*0.36} Q${size*0.5},${size*0.28} ${size*0.34},${size*0.36} Z`,
  ];

  const hairFill = accent + "cc";
  const skinTone = seed % 3 === 0 ? "#d4a574" : seed % 3 === 1 ? "#8d5524" : "#f1c27d";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      {/* bg gradient */}
      <defs>
        <radialGradient id={`pgrad-${name}`} cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`sgrad-${name}`} cx="50%" cy="80%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.12" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <clipPath id={`circ-${name}`}>
          <circle cx={size/2} cy={size/2} r={size/2 - 1} />
        </clipPath>
      </defs>

      {/* ambient fill */}
      <circle cx={size/2} cy={size/2} r={size/2 - 1} fill={`url(#pgrad-${name})`} />
      <circle cx={size/2} cy={size/2} r={size/2 - 1} fill={`url(#sgrad-${name})`} />

      {/* shoulder / torso */}
      <ellipse cx={size/2} cy={size*0.88} rx={size*0.36} ry={size*0.22} fill={accent} opacity="0.18" />
      <rect x={size*0.30} y={size*0.72} width={size*0.40} height={size*0.30} rx={size*0.04} fill={accent} opacity="0.10" />

      {/* neck */}
      <rect x={size*0.43} y={size*0.60} width={size*0.14} height={size*0.14} rx={size*0.03} fill={skinTone} opacity="0.9" />

      {/* head */}
      <ellipse cx={size/2} cy={size*0.42} rx={size*0.22} ry={size*0.26} fill={skinTone} />

      {/* hair */}
      <path d={hairPaths[hairStyle]} fill={hairFill} />

      {/* eyes */}
      <ellipse cx={size*0.43} cy={size*0.40} rx={size*0.035} ry={size*0.028} fill="#0f172a" />
      <ellipse cx={size*0.57} cy={size*0.40} rx={size*0.035} ry={size*0.028} fill="#0f172a" />
      {/* eye shine */}
      <circle cx={size*0.435} cy={size*0.395} r={size*0.008} fill="white" opacity="0.7" />
      <circle cx={size*0.575} cy={size*0.395} r={size*0.008} fill="white" opacity="0.7" />
      {/* iris */}
      <ellipse cx={size*0.43} cy={size*0.40} rx={size*0.020} ry={size*0.018} fill={accent} opacity="0.8" />
      <ellipse cx={size*0.57} cy={size*0.40} rx={size*0.020} ry={size*0.018} fill={accent} opacity="0.8" />

      {/* nose subtle */}
      <path d={`M${size*0.48},${size*0.44} Q${size*0.50},${size*0.50} ${size*0.52},${size*0.44}`} stroke={skinTone} strokeWidth={size*0.012} fill="none" opacity="0.5" />

      {/* mouth */}
      <path
        d={`M${size*0.43},${size*0.53} Q${size*0.50},${isRunning ? size*0.57 : size*0.55} ${size*0.57},${size*0.53}`}
        stroke="#0f172a"
        strokeWidth={size*0.015}
        fill="none"
        opacity="0.7"
        strokeLinecap="round"
      />

      {/* running glow on face */}
      {isRunning && (
        <ellipse cx={size/2} cy={size*0.42} rx={size*0.25} ry={size*0.28} fill={accent} opacity="0.06" />
      )}

      {/* outer ring */}
      <circle cx={size/2} cy={size/2} r={size/2 - 1} fill="none" stroke={accent} strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
}

// ── Status indicators
const STATUS_DOT: Record<string, string> = {
  running:          "bg-emerald-400 animate-pulse",
  idle:             "bg-indigo-400",
  error:            "bg-red-500 animate-pulse",
  paused:           "bg-yellow-400",
  pending_approval: "bg-orange-400 animate-pulse",
  terminated:       "bg-gray-600",
};
const STATUS_LABEL: Record<string, string> = {
  running:          "Working",
  idle:             "Standby",
  error:            "Error",
  paused:           "Paused",
  pending_approval: "Pending",
  terminated:       "Off",
};

// ── Heartbeat trigger
function useHeartbeatTrigger(agentId: string, agentName: string, companyId: string) {
  const { pushToast } = useToast();
  const queryClient  = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/agents/${agentId}/heartbeat/invoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paperclip-company-id": companyId,
          "x-paperclip-local-trusted": "true",
        },
        body: JSON.stringify({ source: "on_demand", triggerDetail: "manual" }),
      });
      if (!res.ok) throw new Error(await res.text() || "Failed");
      return res.json();
    },
    onSuccess: () => {
      pushToast({ title: `${agentName} triggered`, tone: "success" });
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId, agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
    },
    onError: (err) => {
      pushToast({ title: "Trigger failed", body: err instanceof Error ? err.message : "Unknown", tone: "error" });
    },
  });
}

// ── Portrait card
export function AgentPortraitCard({
  agent,
  companyId,
}: {
  agent: Agent;
  companyId: string;
}) {
  const navigate  = useNavigate();
  const [hovered, setHovered] = useState(false);
  const trigger   = useHeartbeatTrigger(agent.id, agent.name, companyId);
  const palette   = getPalette(agent.name);
  const statusKey = (agent.status ?? "idle") as string;
  const role      = getRole(agent.name);
  const lastSeen  = agent.lastHeartbeatAt ? timeAgo(agent.lastHeartbeatAt) : "never";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-xl overflow-hidden cursor-pointer select-none"
      style={{
        background: `linear-gradient(160deg, ${palette.bg[0]} 0%, ${palette.bg[1]} 100%)`,
        border: `1px solid ${palette.accent}22`,
        boxShadow: hovered
          ? `0 0 24px ${palette.glow}, 0 8px 32px rgba(0,0,0,0.4)`
          : `0 0 8px ${palette.glow}44, 0 4px 16px rgba(0,0,0,0.3)`,
        transition: "box-shadow 0.2s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/agents/${agent.urlKey ?? agent.id}`)}
    >
      {/* portrait */}
      <div className="flex justify-center pt-5 pb-1">
        <AgentPortrait
          name={agent.name}
          accent={palette.accent}
          status={statusKey}
          size={100}
        />
      </div>

      {/* info */}
      <div className="px-3 pb-3 text-center">
        <div className="font-bold text-sm text-white truncate leading-tight">{agent.name.replace(" Agent", "")}</div>
        <div
          className="text-[11px] font-medium mt-0.5 truncate"
          style={{ color: palette.accent }}
        >
          {role}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[statusKey] ?? "bg-gray-600")} />
          <span className="text-[10px] text-white/60">
            {STATUS_LABEL[statusKey] ?? statusKey} · {lastSeen}
          </span>
        </div>
      </div>

      {/* hover action bar */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-1 px-2 py-2"
            style={{
              background: `linear-gradient(to top, ${palette.bg[1]}ee, transparent)`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); trigger.mutate(); }}
              disabled={trigger.isPending}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all disabled:opacity-50"
              style={{
                background: palette.accent + "22",
                color: palette.accent,
                border: `1px solid ${palette.accent}44`,
              }}
            >
              {trigger.isPending
                ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                : <Zap className="h-2.5 w-2.5" />}
              RUN
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/agents/${agent.urlKey ?? agent.id}`); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
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
