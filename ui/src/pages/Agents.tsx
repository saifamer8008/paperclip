import { useState, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { timeAgo, agentUrl } from "../lib/utils";
import { PageTabBar } from "../components/PageTabBar";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Bot, Plus, Play, Loader2 } from "lucide-react";
import { type Agent } from "@paperclipai/shared";
import { motion } from "framer-motion";
import { useToast } from "../context/ToastContext";

type FilterTab = "all" | "active" | "paused" | "error";

function filterAgents(agents: Agent[], tab: FilterTab): Agent[] {
    if (tab === "all") return agents;
    return agents.filter(agent => {
        if (tab === "active") return agent.status === "running" || agent.status === "idle";
        if (tab === "paused") return agent.status === "paused";
        if (tab === "error") return agent.status === "error";
        return true;
    });
}

function HeartbeatTriggerButton({ agentId, agentName, companyId }: { agentId: string, agentName: string, companyId: string }) {
    const { toast } = useToast();
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
            toast({
                title: "Heartbeat triggered",
                description: `A new heartbeat run has been triggered for ${agentName}.`,
                variant: "default",
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId, agentId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
        },
        onError: (err) => {
            toast({
                title: "Failed to trigger heartbeat",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            });
        }
    });

    return (
        <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerHeartbeat.mutate();
            }}
            disabled={triggerHeartbeat.isPending}
        >
            {triggerHeartbeat.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
                <Play className="h-3 w-3 mr-1" />
            )}
            Run
        </Button>
    )
}

export function Agents() {
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();
  const pathSegment = location.pathname.split("/").pop() ?? "all";
  const tab: FilterTab = ["all", "active", "paused", "error"].includes(pathSegment) ? pathSegment as FilterTab : "all";

  const { data: agents, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  useMemo(() => {
    setBreadcrumbs([{ label: "Agents" }]);
  }, [setBreadcrumbs]);

  const filteredAgents = useMemo(() => filterAgents(agents ?? [], tab), [agents, tab]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Bot} message="Select a company to view agents." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="grid" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageTabBar
          items={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
            { value: "error", label: "Error" },
          ]}
          value={tab}
          onValueChange={(v) => navigate(`/agents/${v}`)}
        />
        <Button size="sm" variant="outline" onClick={openNewAgent}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Agent
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {agents && agents.length === 0 && (
        <EmptyState
          icon={Bot}
          message="Create your first agent to get started."
          action="New Agent"
          onAction={openNewAgent}
        />
      )}

      {filteredAgents.length > 0 && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          initial="hidden"
          animate="visible"
        >
          {filteredAgents.map((agent) => (
            <motion.div key={agent.id} variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
              <GlassCard
                glow={agent.status === "running"}
                className="flex flex-col h-full p-4"
              >
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 flex items-center justify-center">
                            <span className="text-primary font-semibold text-lg">{agent.name.charAt(0)}</span>
                        </div>
                        <span className="font-semibold">{agent.name}</span>
                        <StatusBadge status={agent.status} className="ml-auto" />
                    </div>
                    {agent.title && (
                        <p className="text-sm text-muted-foreground mt-2">{agent.title}</p>
                    )}
                </div>
                <div className="flex items-center justify-between mt-4 text-sm">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="text-muted-foreground text-xs">
                        {agent.lastHeartbeatAt ? `Active ${timeAgo(agent.lastHeartbeatAt)}` : "Never active"}
                    </span>
                    <HeartbeatTriggerButton agentId={agent.id} agentName={agent.name} companyId={selectedCompanyId} />
                  </div>
                  <Link to={agentUrl(agent)} className="text-primary font-medium hover:underline ml-auto">
                    View →
                  </Link>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
