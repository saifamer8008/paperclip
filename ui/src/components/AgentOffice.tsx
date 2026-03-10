import React, { useState } from "react";
import { useNavigate } from "@/lib/router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/context/CompanyContext";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { GlassCard } from "./ui/glass-card";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/timeAgo";
import type { Agent } from "@paperclipai/shared";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Loader2, ExternalLink, Wifi, WifiOff, Zap } from "lucide-react";

// ── Status helpers ───────────────────────────────────────────────────────────

const STATUS_GLOW: Record<string, string> = {
  running:          "shadow-[0_0_12px_2px_rgba(52,211,153,0.5)]",
  idle:             "shadow-[0_0_6px_1px_rgba(99,102,241,0.3)]",
  error:            "shadow-[0_0_10px_2px_rgba(239,68,68,0.5)]",
  paused:           "shadow-[0_0_6px_1px_rgba(234,179,8,0.3)]",
  pending_approval: "shadow-[0_0_6px_1px_rgba(249,115,22,0.3)]",
  terminated:       "",
};

const STATUS_LAMP: Record<string, string> = {
  running:          "bg-emerald-400 animate-pulse",
  idle:             "bg-indigo-400",
  error:            "bg-red-500 animate-pulse",
  paused:           "bg-yellow-400",
  pending_approval: "bg-orange-400 animate-pulse",
  terminated:       "bg-gray-600",
};

const STATUS_LABEL: Record<string, string> = {
  running:          "running",
  idle:             "idle",
  error:            "error",
  paused:           "paused",
  pending_approval: "pending",
  terminated:       "off",
};

// ── Desk avatar (pure SVG art) ────────────────────────────────────────────────

function AgentDesk({
  initial,
  status,
  isTriggering,
}: {
  initial: string;
  status: string;
  isTriggering: boolean;
}) {
  const isRunning = status === "running";
  const isError   = status === "error";
  const isPaused  = status === "paused";

  // desk color based on status
  const deskColor   = isError ? "#7f1d1d" : isPaused ? "#451a03" : "#1e1b4b";
  const screenColor = isRunning ? "#065f46" : isError ? "#450a0a" : "#1e1b4b";
  const screenGlow  = isRunning ? "#34d399" : isError ? "#ef4444" : "#4f46e5";

  return (
    <svg
      viewBox="0 0 80 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* ── chair ── */}
      <rect x="28" y="54" width="24" height="4" rx="2" fill="#312e81" />
      <rect x="36" y="58" width="8" height="8" rx="1" fill="#312e81" />
      <rect x="30" y="65" width="8" height="3" rx="1" fill="#1e1b4b" />
      <rect x="42" y="65" width="8" height="3" rx="1" fill="#1e1b4b" />

      {/* ── desk surface ── */}
      <rect x="8" y="44" width="64" height="12" rx="3" fill={deskColor} />
      <rect x="8" y="44" width="64" height="3" rx="1" fill="rgba(255,255,255,0.07)" />

      {/* ── monitor stand ── */}
      <rect x="36" y="36" width="8" height="10" rx="1" fill="#1e1b4b" />
      <rect x="30" y="43" width="20" height="2" rx="1" fill="#111827" />

      {/* ── monitor ── */}
      <rect x="18" y="18" width="44" height="28" rx="3" fill="#0f172a" />
      <rect x="20" y="20" width="40" height="24" rx="2" fill={screenColor} />

      {/* screen glow overlay when running */}
      {isRunning && (
        <rect x="20" y="20" width="40" height="24" rx="2" fill={screenGlow} opacity="0.15" />
      )}

      {/* screen content lines */}
      {isRunning ? (
        <>
          <rect x="23" y="24" width="20" height="1.5" rx="0.75" fill="#34d399" opacity="0.8" />
          <rect x="23" y="27" width="30" height="1.5" rx="0.75" fill="#34d399" opacity="0.5" />
          <rect x="23" y="30" width="14" height="1.5" rx="0.75" fill="#34d399" opacity="0.6" />
          <rect x="23" y="33" width="26" height="1.5" rx="0.75" fill="#6ee7b7" opacity="0.4" />
          {/* blinking cursor */}
          <rect x="38" y="33" width="1.5" height="1.5" rx="0.25" fill="#34d399" opacity="0.9" />
        </>
      ) : isError ? (
        <>
          <text x="40" y="35" textAnchor="middle" fontSize="12" fill="#ef4444">!</text>
        </>
      ) : (
        <>
          <rect x="23" y="28" width="18" height="1.5" rx="0.75" fill="#4f46e5" opacity="0.4" />
          <rect x="23" y="31" width="24" height="1.5" rx="0.75" fill="#4f46e5" opacity="0.3" />
          <rect x="23" y="34" width="12" height="1.5" rx="0.75" fill="#4f46e5" opacity="0.2" />
        </>
      )}

      {/* monitor border */}
      <rect x="18" y="18" width="44" height="28" rx="3" stroke="rgba(255,255,255,0.1)" strokeWidth="0.75" />

      {/* ── keyboard ── */}
      <rect x="22" y="47" width="28" height="5" rx="1.5" fill="#111827" opacity="0.9" />
      {[0,1,2,3,4].map((i) => (
        <rect key={i} x={24 + i * 5} y={48.5} width="3.5" height="1.5" rx="0.5" fill="#1e293b" />
      ))}

      {/* ── mouse ── */}
      <rect x="53" y="47" width="8" height="5" rx="2" fill="#111827" opacity="0.9" />

      {/* ── coffee mug ── */}
      <rect x="4" y="42" width="6" height="7" rx="1" fill="#7c3aed" opacity="0.8" />
      <path d="M10 44.5 Q13 44.5 13 46.5 Q13 48 10 48" stroke="#7c3aed" strokeWidth="1.2" fill="none" opacity="0.8" />
      {/* steam */}
      <path d="M6 41 Q6.5 39.5 6 38" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" fill="none" />
      <path d="M8 41 Q8.5 39 8 38" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" fill="none" />

      {/* ── agent avatar (head) ── */}
      <circle cx="40" cy="10" r="8" fill="#4f46e5" />
      <circle cx="40" cy="10" r="8" fill="url(#agGrad)" />
      <text
        x="40"
        y="14"
        textAnchor="middle"
        fontSize="9"
        fontWeight="bold"
        fill="white"
        fontFamily="system-ui, sans-serif"
      >
        {initial}
      </text>

      {/* status lamp on desk */}
      <circle cx="68" cy="47" r="2.5" fill={isRunning ? "#34d399" : isError ? "#ef4444" : isPaused ? "#facc15" : "#4f46e5"} opacity={isRunning || isError ? "1" : "0.6"} />

      {/* trigger animation overlay */}
      {isTriggering && (
        <rect x="18" y="18" width="44" height="28" rx="3" fill="#34d399" opacity="0.15" />
      )}

      <defs>
        <radialGradient id="agGrad" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// ── Heartbeat trigger ─────────────────────────────────────────────────────────

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
      pushToast({ title: "Failed to trigger", body: err instanceof Error ? err.message : "Unknown error", tone: "error" });
    },
  });
}

// ── Single desk card ──────────────────────────────────────────────────────────

function DeskCard({ agent, companyId }: { agent: Agent; companyId: string }) {
  const navigate  = useNavigate();
  const [hovered, setHovered] = useState(false);
  const trigger   = useHeartbeatTrigger(agent.id, agent.name, companyId);
  const statusKey = (agent.status ?? "idle") as string;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm",
        "transition-all duration-200 cursor-pointer select-none",
        STATUS_GLOW[statusKey] ?? "",
        hovered && "border-white/[0.15] bg-white/[0.06]"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/agents/${agent.urlKey ?? agent.id}`)}
    >
      {/* desk art */}
      <div className="px-3 pt-3 pb-1">
        <AgentDesk
          initial={agent.name.charAt(0).toUpperCase()}
          status={statusKey}
          isTriggering={trigger.isPending}
        />
      </div>

      {/* name + status row */}
      <div className="px-3 pb-2 flex items-center justify-between gap-1">
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate leading-tight">{agent.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {agent.lastHeartbeatAt ? timeAgo(agent.lastHeartbeatAt) : "never"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* status lamp */}
          <span className={cn("w-2 h-2 rounded-full", STATUS_LAMP[statusKey] ?? "bg-gray-600")} />
          <span className="text-[10px] text-muted-foreground">{STATUS_LABEL[statusKey] ?? statusKey}</span>
        </div>
      </div>

      {/* action bar — visible on hover */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-1 px-2 py-1.5 rounded-b-xl bg-black/50 backdrop-blur-sm border-t border-white/[0.06]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                trigger.mutate();
              }}
              disabled={trigger.isPending}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors",
                "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
              )}
            >
              {trigger.isPending
                ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                : <Zap className="h-2.5 w-2.5" />}
              Run
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/agents/${agent.urlKey ?? agent.id}`);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-white/[0.07] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              View
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Office floor legend ───────────────────────────────────────────────────────

function OfficeLegend() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
      {[
        { color: "bg-emerald-400", label: "running" },
        { color: "bg-indigo-400",  label: "idle" },
        { color: "bg-yellow-400",  label: "paused" },
        { color: "bg-red-500",     label: "error" },
      ].map(({ color, label }) => (
        <span key={label} className="flex items-center gap-1">
          <span className={cn("w-1.5 h-1.5 rounded-full", color)} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export const AgentOffice = React.memo(({ agents }: { agents: Agent[] | undefined }) => {
  const { selectedCompanyId } = useCompany();

  if (!selectedCompanyId) return null;

  const sorted = [...(agents ?? [])].sort((a, b) => {
    const order = ["running", "idle", "error", "paused", "pending_approval", "terminated"];
    return (order.indexOf(a.status) ?? 99) - (order.indexOf(b.status) ?? 99);
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Wifi className="h-3 w-3" /> Agent Office
        </h3>
        <OfficeLegend />
      </div>
      <GlassCard className="p-3">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <WifiOff className="h-4 w-4 mr-2" /> No agents yet
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            initial="hidden"
            animate="visible"
          >
            {sorted.map((agent) => (
              <DeskCard key={agent.id} agent={agent} companyId={selectedCompanyId} />
            ))}
          </motion.div>
        )}
      </GlassCard>
    </div>
  );
});
