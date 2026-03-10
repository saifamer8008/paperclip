import { useState, useMemo, useEffect } from "react";
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
import { HudPageShell, HudButton } from "../components/HudPageShell";
import { agentUrl } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { AgentOffice } from "@/components/AgentOffice";
import { Bot, Plus, Loader2, Zap } from "lucide-react";
import { type Agent } from "@paperclipai/shared";
import { motion } from "framer-motion";
import { useToast } from "../context/ToastContext";

const GOLD = "#C9A84C";

type View = "office" | "list";

const STATUS_COLOR: Record<string, string> = {
  running: "#34d399", idle: "#818cf8", error: "#f87171",
  paused: "#fbbf24", pending_approval: "#fb923c", terminated: "#4b5563",
};

function HeartbeatTriggerButton({ agentId, agentName, companyId }: { agentId: string; agentName: string; companyId: string }) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const trigger = useMutation({
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
      pushToast({ title: "Heartbeat triggered", body: `${agentName} is now running.`, tone: "success" });
      queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(companyId, agentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
    },
    onError: (e) => pushToast({ title: "Failed", body: e instanceof Error ? e.message : "Unknown", tone: "error" }),
  });

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); trigger.mutate(); }}
      disabled={trigger.isPending}
      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-50"
      style={{ background: `${GOLD}14`, color: GOLD, border: `1px solid ${GOLD}33`, fontFamily: "monospace" }}
    >
      {trigger.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Zap className="h-2.5 w-2.5" />}
      Run
    </button>
  );
}

export function Agents() {
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const view: View = searchParams.get('view') === "list" ? "list" : "office";

  const { data: agents, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10000,
  });

  useEffect(() => { setBreadcrumbs([{ label: "Agents" }]); }, [setBreadcrumbs]);

  const setView = (newView: View) => {
    navigate(`/agents?view=${newView}`);
  };

  if (!selectedCompanyId) return <EmptyState icon={Bot} message="Select a company to view agents." />;
  if (isLoading) return <PageSkeleton variant="list" />;

  const TabButton = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="px-4 py-2 text-xs font-bold tracking-widest uppercase rounded-md transition-all"
      style={{
        color: active ? GOLD : "rgba(255,255,255,0.4)",
        border: active ? `1px solid ${GOLD}` : "1px solid transparent",
        backgroundColor: active ? "rgba(201, 168, 76, 0.1)" : "transparent",
      }}
    >
      {children}
    </button>
  );

  return (
    <HudPageShell
      icon={Bot}
      title="Agents"
      subtitle={`${agents?.length ?? 0} agents total · ${agents?.filter((a) => a.status === "running").length ?? 0} active`}
      action={
        <HudButton onClick={openNewAgent}>
          <Plus className="h-3 w-3" /> New Agent
        </HudButton>
      }
      tabs={
        <div className="flex items-center gap-2">
          <TabButton active={view === "office"} onClick={() => setView("office")}>Office</TabButton>
          <TabButton active={view === "list"} onClick={() => setView("list")}>List</TabButton>
        </div>
      }
    >
      {error && <p className="text-xs text-destructive font-mono">{(error as Error).message}</p>}

      {agents?.length === 0 && (
        <EmptyState icon={Bot} message="Create your first agent to get started." action="New Agent" onAction={openNewAgent} />
      )}

      {view === "office" && agents && selectedCompanyId && (
        <div className="w-full max-w-full">
          <AgentOffice agents={agents} />
        </div>
      )}

      {view === "list" && agents && agents.length > 0 && (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
          variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
          initial="hidden"
          animate="visible"
        >
          {agents.map((agent) => {
            const color = STATUS_COLOR[agent.status] ?? "#6b7280";
            return (
              <motion.div key={agent.id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                <div
                  className="relative flex flex-col gap-3 p-4 rounded-xl h-full transition-all duration-150 hover:translate-y-[-1px]"
                  style={{
                    background: `linear-gradient(160deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.25) 100%)`,
                    border: `1px solid ${color}33`,
                    boxShadow: agent.status === "running" ? `0 0 16px ${color}22` : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-black text-base"
                      style={{ background: `${color}18`, border: `1px solid ${color}33`, color, fontFamily: "monospace" }}
                    >
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-white/90 truncate" style={{ fontFamily: "monospace" }}>
                        {agent.name.replace(" Agent", "")}
                      </div>
                      {agent.title && <div className="text-[10px] text-white/45 truncate">{agent.title}</div>}
                    </div>
                    <StatusBadge status={agent.status} />
                  </div>
                  <div className="text-[10px] text-white/40 font-mono">
                    {agent.lastHeartbeatAt ? `Last active ${timeAgo(agent.lastHeartbeatAt)}` : "Never active"}
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-1 border-t border-white/[0.05]">
                    <HeartbeatTriggerButton agentId={agent.id} agentName={agent.name} companyId={selectedCompanyId!} />
                    <Link
                      to={agentUrl(agent)}
                      className="text-[10px] font-bold tracking-widest uppercase no-underline hover:opacity-80 transition-opacity"
                      style={{ color: GOLD, fontFamily: "monospace" }}
                    >
                      View →
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </HudPageShell>
  );
}
