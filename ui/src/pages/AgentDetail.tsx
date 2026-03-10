import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { GlassCard } from "@/components/ui/glass-card";
import { HudPageShell, HudButton } from "../components/HudPageShell";
import { Button } from "@/components/ui/button";
import { formatCents, cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { type Agent, type HeartbeatRun } from "@paperclipai/shared";
import { CheckCircle2, XCircle, Clock, Loader2, Slash, Timer, Play, Bot, Zap } from 'lucide-react';
import { useToast } from "../context/ToastContext";

const GOLD = "#C9A84C";
const STATUS_COLOR: Record<string, string> = {
  running: "#34d399", idle: "#818cf8", error: "#f87171",
  paused: "#fbbf24", pending_approval: "#fb923c", terminated: "#4b5563",
};

const runStatusTimeline = {
    succeeded: {
        icon: CheckCircle2,
        color: "bg-emerald-500",
        label: "Succeeded",
    },
    failed: {
        icon: XCircle,
        color: "bg-red-500",
        label: "Failed",
    },
    running: {
        icon: Loader2,
        color: "bg-yellow-500",
        label: "Running",
    },
    queued: {
        icon: Clock,
        color: "bg-gray-500",
        label: "Queued",
    },
    timed_out: {
        icon: Timer,
        color: "bg-orange-500",
        label: "Timed Out",
    },
    cancelled: {
        icon: Slash,
        color: "bg-gray-500",
        label: "Cancelled",
    },
} as const;

function HeartbeatTriggerButton({ agentId, agentName, companyId }: { agentId: string, agentName: string, companyId: string }) {
    const { pushToast } = useToast();
    const queryClient = useQueryClient();

    const triggerHeartbeat = useMutation({
        mutationFn: async () => {
            const response = await fetch(`/api/agents/${agentId}/heartbeat/invoke`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-paperclip-company-id': companyId,
                    'x-paperclip-local-trusted': 'true'
                },
                body: JSON.stringify({
                    source: "on_demand",
                    triggerDetail: "manual",
                })
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Failed to trigger heartbeat");
            }
            return response.json();
        },
        onSuccess: () => {
            pushToast({ title: "Heartbeat triggered", body: `A new heartbeat run has been triggered for ${agentName}.`, tone: "success" });
            queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId, agentId) });
        },
        onError: (err) => {
            pushToast({ title: "Failed to trigger heartbeat", body: err instanceof Error ? err.message : "Unknown error", tone: "error" });
        }
    });

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={() => triggerHeartbeat.mutate()}
            disabled={triggerHeartbeat.isPending}
        >
            {triggerHeartbeat.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
                <Play className="h-4 w-4 mr-2" />
            )}
            Trigger Heartbeat
        </Button>
    )
}


export function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const { data: agent, isLoading: isAgentLoading, error: agentError } = useQuery({
    queryKey: queryKeys.agents.detail(agentId ?? ""),
    queryFn: () => agentsApi.get(agentId!, selectedCompanyId ?? undefined),
    enabled: !!selectedCompanyId,
  });

  const { data: heartbeats, isLoading: isHeartbeatsLoading, error: heartbeatsError } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!, agentId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!, agentId!),
    enabled: !!selectedCompanyId && !!agentId,
    refetchInterval: 5000, // Poll for updates
  });

  useEffect(() => {
    if (agent) {
      setBreadcrumbs([
        { label: "Agents", href: "/agents" },
        { label: agent.name },
      ]);
    }
  }, [agent, setBreadcrumbs]);

  const stats = useMemo(() => {
    if (!heartbeats) return { totalRuns: 0, successRate: 0, lastActive: "N/A" };

    const totalRuns = heartbeats.length;
    const successfulRuns = heartbeats.filter(r => r.status === "succeeded").length;
    const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;
    const lastActive = heartbeats[0]?.createdAt ? timeAgo(heartbeats[0].createdAt) : "N/A";

    return {
      totalRuns,
      successRate,
      lastActive
    };
  }, [heartbeats]);

  if (isAgentLoading || isHeartbeatsLoading) return <PageSkeleton variant="detail" />;
  if (agentError) return <p className="text-sm text-destructive">{agentError.message}</p>;
  if (!agent) return null;

  const statusColor = STATUS_COLOR[agent.status] ?? "#6b7280";

  return (
    <HudPageShell
      icon={Bot}
      title={agent.name}
      subtitle={agent.title ?? `Status: ${agent.status}`}
      action={
        selectedCompanyId && (
          <HeartbeatTriggerButton agentId={agent.id} agentName={agent.name} companyId={selectedCompanyId} />
        )
      }
    >
      {/* Status indicator strip */}
      <div
        className="flex items-center gap-3 px-4 py-2 rounded-lg"
        style={{ background: `${statusColor}0f`, border: `1px solid ${statusColor}33` }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
        />
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: statusColor, fontFamily: "monospace" }}>
          {agent.status}
        </span>
        {agent.lastHeartbeatAt && (
          <span className="text-[10px] text-white/40 font-mono ml-auto">
            Last active {timeAgo(agent.lastHeartbeatAt)}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Runs",    value: String(stats.totalRuns) },
          { label: "Success Rate",  value: `${stats.successRate.toFixed(1)}%` },
          { label: "Last Active",   value: stats.lastActive },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col gap-1 p-4 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${GOLD}22` }}
          >
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-mono">{label}</span>
            <span className="text-2xl font-black" style={{ color: GOLD, fontFamily: "monospace" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Heartbeat history */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-black tracking-widest uppercase" style={{ color: GOLD, fontFamily: "monospace" }}>
            ◈ Heartbeat History
          </span>
          {isHeartbeatsLoading && <Loader2 className="h-3 w-3 animate-spin text-white/30" />}
        </div>

        {heartbeatsError && <p className="text-xs text-destructive font-mono">{(heartbeatsError as Error).message}</p>}
        {heartbeats?.length === 0 && (
          <p className="text-xs text-white/30 font-mono py-4">No heartbeats recorded.</p>
        )}

        <div className="space-y-2">
          {heartbeats?.map((run) => {
            const statusInfo = runStatusTimeline[run.status as keyof typeof runStatusTimeline] || runStatusTimeline.queued;
            const Icon = statusInfo.icon;
            const runColor = statusInfo.color.includes("emerald") ? "#34d399"
              : statusInfo.color.includes("red") ? "#f87171"
              : statusInfo.color.includes("yellow") ? "#fbbf24"
              : "#818cf8";
            return (
              <div
                key={run.id}
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ background: `${runColor}08`, border: `1px solid ${runColor}22` }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: `${runColor}20`, border: `1px solid ${runColor}44` }}
                >
                  <Icon size={13} style={{ color: runColor }} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold" style={{ color: runColor, fontFamily: "monospace" }}>
                      {statusInfo.label}
                    </span>
                    <span className="text-[10px] text-white/35 font-mono shrink-0">{timeAgo(run.createdAt)}</span>
                  </div>
                  {run.stdoutExcerpt && (
                    <p className="text-[10px] font-mono text-white/40 mt-1 leading-relaxed truncate">
                      {run.stdoutExcerpt.slice(0, 120)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </HudPageShell>
  );
}
