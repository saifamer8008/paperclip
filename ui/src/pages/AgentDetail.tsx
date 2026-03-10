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
import { formatCents, cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { type Agent, type HeartbeatRun } from "@paperclipai/shared";
import { CheckCircle2, XCircle, Clock, Loader2, Slash, Timer, Play } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "../context/ToastContext";

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

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                {agent.title && <p className="text-muted-foreground">{agent.title}</p>}
            </div>
            {selectedCompanyId && (
                <HeartbeatTriggerButton agentId={agent.id} agentName={agent.name} companyId={selectedCompanyId} />
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard className="p-4">
                <div className="text-sm text-muted-foreground">Total Runs</div>
                <div className="text-2xl font-bold">{stats.totalRuns}</div>
            </GlassCard>
            <GlassCard className="p-4">
                <div className="text-sm text-muted-foreground">Success Rate</div>
                <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
            </GlassCard>
            <GlassCard className="p-4">
                <div className="text-sm text-muted-foreground">Last Active</div>
                <div className="text-2xl font-bold">{stats.lastActive}</div>
            </GlassCard>
        </div>

        <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              Heartbeat History
              {isHeartbeatsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </h2>
            <div className="space-y-4">
                {heartbeatsError && <p className="text-sm text-destructive">{heartbeatsError.message}</p>}
                {heartbeats && heartbeats.length === 0 && <p className="text-sm text-muted-foreground">No heartbeats recorded.</p>}
                {heartbeats?.map(run => {
                    const statusInfo = runStatusTimeline[run.status as keyof typeof runStatusTimeline] || runStatusTimeline.queued;
                    const Icon = statusInfo.icon;
                    return (
                        <div key={run.id} className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white", statusInfo.color)}>
                                    <Icon size={16} />
                                </div>
                                <div className="w-px h-full bg-border"></div>
                            </div>
                            <div className="flex-1 pt-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{statusInfo.label}</span>
                                    <span className="text-sm text-muted-foreground">{timeAgo(run.createdAt)}</span>
                                </div>
                                {run.stdoutExcerpt && (
                                    <p className="text-xs font-mono text-muted-foreground mt-1 bg-background/50 p-2 rounded-md">{run.stdoutExcerpt.slice(0, 100)}...</p>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    </div>
  );
}
