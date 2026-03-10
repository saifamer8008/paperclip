import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router";
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
  running: "#34d399",
  idle: "#818cf8",
  error: "#f87171",
  paused: "#fbbf24",
  pending_approval: "#fb923c",
  terminated: "#4b5563",
};

function HeartbeatTriggerButton({ agentId, agentName, companyId }: { agentId: string; agentName: string; companyId: string }) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const trigger = useMutation({
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
      if (!r.ok) throw new Error((await r.text()) || "Failed");
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
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        trigger.mutate();
      }}
      disabled={trigger.isPending}
      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
      style={{ background: `${GOLD}14`, color: GOLD, border: `1px solid ${GOLD}33`, fontFamily: "monospace" }}
    >
      {trigger.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Zap className="h-2.5 w-2.5" />}
      Run
    </button>
  );
}

function ViewTabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all"
      style={{
        color: active ? GOLD : "rgba(255,255,255,0.4)",
        border: `1px solid ${active ? GOLD : "transparent"}`,
        background: active ? "rgba(201, 168, 76, 0.10)" : "transparent",
        fontFamily: "'Space Mono','Courier New',monospace",
      }}
    >
      {children}
    </button>
  );
}

export function Agents() {
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();
  const view: View = new URLSearchParams(location.search).get("view") === "list" ? "list" : "office";

  const { data: agents, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10000,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Agents" }]);
  }, [setBreadcrumbs]);

  const setView = (nextView: View) => {
    navigate(`/agents?view=${nextView}`);
  };

  if (!selectedCompanyId) return <EmptyState icon={Bot} message="Select a company to view agents." />;
  if (isLoading) return <PageSkeleton variant="list" />;

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
          <ViewTabButton active={view === "office"} onClick={() => setView("office")}>OFFICE</ViewTabButton>
          <ViewTabButton active={view === "list"} onClick={() => setView("list")}>LIST</ViewTabButton>
        </div>
      }
      className={view === "office" ? "w-full max-w-none" : undefined}
    >
      {error && <p className="font-mono text-xs text-destructive">{(error as Error).message}</p>}

      {agents?.length === 0 && (
        <EmptyState icon={Bot} message="Create your first agent to get started." action="New Agent" onAction={openNewAgent} />
      )}

      {view === "office" && agents && (
        <div className="w-full max-w-none">
          <AgentOffice agents={agents} companyId={selectedCompanyId} />
        </div>
      )}

      {view === "list" && agents && agents.length > 0 && (
        <motion.div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
          initial="hidden"
          animate="visible"
        >
          {agents.map((agent: Agent) => {
            const color = STATUS_COLOR[agent.status] ?? "#6b7280";
            return (
              <motion.div key={agent.id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                <div
                  className="relative flex h-full flex-col gap-3 rounded-xl p-4 transition-all duration-150 hover:translate-y-[-1px]"
                  style={{
                    background: "linear-gradient(160deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.25) 100%)",
                    border: `1px solid ${color}33`,
                    boxShadow: agent.status === "running" ? `0 0 16px ${color}22` : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-black text-base"
                      style={{ background: `${color}18`, border: `1px solid ${color}33`, color, fontFamily: "monospace" }}
                    >
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-white/90" style={{ fontFamily: "monospace" }}>
                        {agent.name.replace(" Agent", "")}
                      </div>
                      {agent.title && <div className="truncate text-[10px] text-white/45">{agent.title}</div>}
                    </div>
                    <StatusBadge status={agent.status} />
                  </div>

                  <div className="font-mono text-[10px] text-white/40">
                    {agent.lastHeartbeatAt ? `Last active ${timeAgo(agent.lastHeartbeatAt)}` : "Never active"}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-white/[0.05] pt-1">
                    <HeartbeatTriggerButton agentId={agent.id} agentName={agent.name} companyId={selectedCompanyId} />
                    <Link
                      to={agentUrl(agent)}
                      className="text-[10px] font-bold uppercase tracking-widest no-underline transition-opacity hover:opacity-80"
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
