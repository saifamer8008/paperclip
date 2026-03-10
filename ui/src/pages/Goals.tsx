import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Target, Plus } from "lucide-react";

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
import type { Agent, Goal, Project } from "@paperclipai/shared";

const GOLD = "#C9A84C";

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

      {(!goals || goals.length === 0) && (
        <EmptyState icon={Target} message="No goals yet." action="Add Goal" onAction={() => openNewGoal()} />
      )}

      {goals && goals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {goals.map((goal) => {
            // Goals have ownerAgentId, link to projects via parent goal relationships
            const agent = (goal as Goal & { ownerAgentId?: string | null }).ownerAgentId
              ? agentMap.get((goal as Goal & { ownerAgentId?: string | null }).ownerAgentId!)
              : undefined;
            return (
              <GoalCard
                key={goal.id}
                goal={goal}
                agent={agent}
              />
            );
          })}
        </div>
      )}
    </HudPageShell>
  );
}
