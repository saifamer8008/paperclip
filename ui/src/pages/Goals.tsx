import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Target, Plus, ExternalLink } from "lucide-react";

import { goalsApi } from "../api/goals";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { HudPageShell, HudButton } from "../components/HudPageShell";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/StatusBadge";
import { notionApi, type NotionGoal } from "../api/notion";
import type { Agent, Goal, Project } from "@paperclipai/shared";

const GOLD = "#C9A84C";
const PRIORITY_COLOR: Record<string, string> = {
  P1: "#f87171", P2: "#fbbf24", P3: "#818cf8",
  Urgent: "#f87171", High: "#fbbf24", Medium: "#818cf8",
};

function NotionGoalsSidebar() {
  const { data, isLoading } = useQuery({
    queryKey: ["notion-summary"],
    queryFn: () => notionApi.summary(),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${GOLD}20` }}>
      <div className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <svg viewBox="0 0 16 16" width={12} height={12} fill="none">
          <rect x="1" y="1" width="14" height="14" rx="2.5" stroke={GOLD} strokeWidth="1.3" />
          <rect x="3.5" y="4.5" width="9" height="1.3" rx="0.65" fill={GOLD} fillOpacity="0.7" />
          <rect x="3.5" y="7.5" width="6" height="1.3" rx="0.65" fill={GOLD} fillOpacity="0.5" />
          <rect x="3.5" y="10.5" width="7" height="1.3" rx="0.65" fill={GOLD} fillOpacity="0.35" />
        </svg>
        <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: GOLD, fontFamily: "monospace" }}>
          Notion · Company Goals
        </span>
      </div>
      {isLoading && <p className="text-[9px] font-mono text-white/25 px-3 py-2 animate-pulse">Loading…</p>}
      {data?.goals.map((g: NotionGoal) => {
        const c = PRIORITY_COLOR[g.status] ?? GOLD;
        return (
          <a key={g.id} href={g.url} target="_blank" rel="noreferrer" className="no-underline block">
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors group">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
              <span className="flex-1 text-[11px] text-white/65 group-hover:text-white/90 transition-colors truncate">
                {g.name}
              </span>
              {g.status && (
                <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ color: c, background: `${c}12`, border: `1px solid ${c}25`, fontFamily: "monospace" }}>
                  {g.status}
                </span>
              )}
              <ExternalLink className="w-2.5 h-2.5 text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
            </div>
          </a>
        );
      })}
      {data?.goals.length === 0 && (
        <p className="text-[9px] font-mono text-white/20 px-3 py-2">No Notion goals found</p>
      )}
    </div>
  );
}

function GoalProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.min(100, value)}%`, background: GOLD }}
      />
    </div>
  );
}

function GoalCard({ goal, agent, project }: { goal: Goal; agent?: Agent; project?: Project }) {
  const progress = goal.status === "achieved" ? 100 : goal.status === "active" ? 50 : 0;

  return (
    <GlassCard className="p-4 flex flex-col gap-3 hover:bg-white/[0.03] transition-colors">
      <Link to={`/goals/${goal.id}`} className="no-underline text-inherit">
        <h3 className="font-bold text-sm truncate">{goal.title}</h3>
        {goal.description && (
          <p className="text-xs text-white/50 mt-1 line-clamp-2">{goal.description}</p>
        )}
      </Link>

      <div className="mt-auto space-y-2">
        <div className="flex items-center justify-between">
          <StatusBadge status={goal.status} />
          <span className="text-[10px] font-mono text-white/40">{progress}%</span>
        </div>
        <GoalProgressBar value={progress} />
        <div className="flex items-center justify-between text-[11px] text-white/40 font-mono pt-0.5">
          <span>{agent ? agent.name : "Unassigned"}</span>
          {project && (
            <Link to={`/projects/${project.id}`} className="no-underline text-white/40 hover:text-white/80 transition-colors">
              {project.name}
            </Link>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

export function Goals() {
  const { selectedCompanyId } = useCompany();
  const { openNewGoal } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => { setBreadcrumbs([{ label: "Goals" }]); }, [setBreadcrumbs]);

  const { data: goals, isLoading, error } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { agentMap, projectMap } = useMemo(() => {
    const agentMap = new Map<string, Agent>();
    (agents ?? []).forEach(a => agentMap.set(a.id, a));
    const projectMap = new Map<string, Project>();
    (projects ?? []).forEach(p => projectMap.set(p.id, p));
    return { agentMap, projectMap };
  }, [agents, projects]);

  if (!selectedCompanyId) return <EmptyState icon={Target} message="Select a company to view goals." />;
  if (isLoading) return <PageSkeleton variant="list" />;

  return (
    <HudPageShell
      icon={Target}
      title="Goals"
      subtitle={`${goals?.length ?? 0} goals`}
      action={
        <HudButton onClick={() => openNewGoal()}>
          <Plus className="h-3 w-3" /> New Goal
        </HudButton>
      }
    >
      {error && <p className="text-xs text-destructive font-mono">{(error as Error).message}</p>}

      {/* Two-column layout: goals grid + Notion sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">
        <div>
          {(!goals || goals.length === 0) && (
            <EmptyState icon={Target} message="No goals yet." action="Add Goal" onAction={() => openNewGoal()} />
          )}
          {goals && goals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {goals.map((goal) => {
                const agent = (goal as Goal & { ownerAgentId?: string | null }).ownerAgentId
                  ? agentMap.get((goal as Goal & { ownerAgentId?: string | null }).ownerAgentId!)
                  : undefined;
                return <GoalCard key={goal.id} goal={goal} agent={agent} />;
              })}
            </div>
          )}
        </div>
        <NotionGoalsSidebar />
      </div>
    </HudPageShell>
  );
}
