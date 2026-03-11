import { useEffect, useMemo } from "react";
import { useNavigate } from "@/lib/router";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { costsApi } from "../api/costs";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { HudPageShell, HudButton } from "../components/HudPageShell";
import { AgentOffice } from "@/components/AgentOffice";
import { EliteCard } from "@/components/EliteCard";
import { Bot, Plus, Zap, Loader2, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { type Agent } from "@paperclipai/shared";
import { timeAgo } from "../lib/timeAgo";
import { formatCents } from "../lib/utils";
import { useToast } from "../context/ToastContext";
import { agentUrl } from "../lib/utils";

const GOLD = "#C9A84C";

const STATUS_COLOR: Record<string, string> = {
  running: "#34d399",
  idle: "#818cf8",
  error: "#f87171",
  paused: "#fbbf24",
  pending_approval: "#fb923c",
  terminated: "#374151",
};
const STATUS_LABEL: Record<string, string> = {
  running: "RUNNING",
  idle: "STANDBY",
  error: "ERROR",
  paused: "PAUSED",
  pending_approval: "APPROVAL",
  terminated: "TERMINATED",
};

type View = "office" | "grid";

function ViewTabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all"
      style={{
        color: active ? GOLD : "rgba(255,255,255,0.4)",
        border: `1px solid ${active ? GOLD : "transparent"}`,
        background: active ? "rgba(201,168,76,0.10)" : "transparent",
        fontFamily: "'Space Mono','Courier New',monospace",
      }}
    >
      {children}
    </button>
  );
}

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
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); trigger.mutate(); }}
      disabled={trigger.isPending}
      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
      style={{ background: `${GOLD}14`, color: GOLD, border: `1px solid ${GOLD}33`, fontFamily: "monospace" }}
    >
      {trigger.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Zap className="h-2.5 w-2.5" />}
      Run
    </button>
  );
}

// ── Fleet status bar ──────────────────────────────────────────────────────────
function FleetStatusBar({ agents, issueCounts, totalCostCents }: {
  agents: Agent[];
  issueCounts: Map<string, number>;
  totalCostCents: number;
}) {
  const byStatus = agents.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stats = [
    { label: "Total",    value: agents.length,              color: GOLD },
    { label: "Running",  value: byStatus.running ?? 0,      color: "#34d399" },
    { label: "Standby",  value: byStatus.idle ?? 0,         color: "#818cf8" },
    { label: "Error",    value: byStatus.error ?? 0,        color: "#f87171" },
    { label: "Open Tasks", value: [...issueCounts.values()].reduce((a, b) => a + b, 0), color: "#fbbf24" },
    { label: "30d Spend",  value: formatCents(totalCostCents), color: GOLD, isStr: true },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {stats.map(s => (
        <div key={s.label} className="rounded-xl px-3 py-2.5 text-center"
          style={{ background: "rgba(0,0,0,0.35)", border: `1px solid rgba(255,255,255,0.05)` }}>
          <div className="text-[18px] font-black tabular-nums leading-none" style={{ color: s.color, fontFamily: "monospace" }}>
            {s.value}
          </div>
          <div className="text-[8px] tracking-widest uppercase mt-0.5 text-white/30" style={{ fontFamily: "monospace" }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Agent row (list variant) ──────────────────────────────────────────────────
function AgentGridCard({ agent, openIssues, companyId, onView }: {
  agent: Agent;
  openIssues: number;
  companyId: string;
  onView: () => void;
}) {
  const c = STATUS_COLOR[agent.status] ?? "#6b7280";
  const lbl = STATUS_LABEL[agent.status] ?? agent.status.toUpperCase();
  return (
    <div onClick={onView} className="cursor-pointer">
      <EliteCard
        name={agent.name.replace(/\s*Agent\s*$/i, "")}
        title={agent.title ?? undefined}
        role={agent.role ?? undefined}
        statusColor={c}
        statusLabel={lbl}
        lastSeen={agent.lastHeartbeatAt ? timeAgo(agent.lastHeartbeatAt) : "Never"}
        isLive={agent.status === "running"}
        isHuman={false}
        onView={onView}
        onPing={() => {}}
      />
      {openIssues > 0 && (
        <div className="mt-1 text-center text-[8px] font-mono" style={{ color: "#fbbf24" }}>
          {openIssues} open task{openIssues !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

export function Agents() {
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const location = useLocation();
  const view: View = new URLSearchParams(location.search).get("view") === "office" ? "office" : "grid";

  useEffect(() => { setBreadcrumbs([{ label: "Agents" }]); }, [setBreadcrumbs]);

  const { data: agents, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10000,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: costSummary } = useQuery({
    queryKey: queryKeys.costs(selectedCompanyId!),
    queryFn: () => costsApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const issueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of issues ?? []) {
      if (issue.assigneeAgentId && issue.status !== "done" && issue.status !== "cancelled") {
        counts.set(issue.assigneeAgentId, (counts.get(issue.assigneeAgentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [issues]);

  const totalCostCents = costSummary?.spendCents ?? 0;

  const setView = (v: View) => navigate(`/agents?view=${v}`);

  if (!selectedCompanyId) return <EmptyState icon={Bot} message="Select a company to view agents." />;
  if (isLoading) return <PageSkeleton variant="list" />;

  const agentList = agents ?? [];
  const runningCount = agentList.filter(a => a.status === "running").length;

  return (
    <HudPageShell
      icon={Bot}
      title="Agent Fleet"
      subtitle={`${agentList.length} agents · ${runningCount} active`}
      action={
        <HudButton onClick={openNewAgent}>
          <Plus className="h-3 w-3" /> New Agent
        </HudButton>
      }
      tabs={
        <div className="flex items-center gap-2">
          <ViewTabButton active={view === "grid"} onClick={() => setView("grid")}>GRID</ViewTabButton>
          <ViewTabButton active={view === "office"} onClick={() => setView("office")}>OFFICE</ViewTabButton>
        </div>
      }
      className={view === "office" ? "w-full max-w-none" : undefined}
    >
      {error && <p className="font-mono text-xs text-destructive">{(error as Error).message}</p>}

      {agentList.length === 0 && (
        <EmptyState icon={Bot} message="Create your first agent to get started." action="New Agent" onAction={openNewAgent} />
      )}

      {/* Fleet stats bar — always visible */}
      {agentList.length > 0 && view === "grid" && (
        <FleetStatusBar agents={agentList} issueCounts={issueCounts} totalCostCents={totalCostCents} />
      )}

      {view === "office" && agentList.length > 0 && (
        <div className="w-full max-w-none">
          <AgentOffice agents={agentList} companyId={selectedCompanyId} />
        </div>
      )}

      {view === "grid" && agentList.length > 0 && (
        <div className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {agentList.map((agent: Agent) => (
            <AgentGridCard
              key={agent.id}
              agent={agent}
              openIssues={issueCounts.get(agent.id) ?? 0}
              companyId={selectedCompanyId}
              onView={() => navigate(agentUrl(agent))}
            />
          ))}
        </div>
      )}
    </HudPageShell>
  );
}
