import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { goalsApi } from "../api/goals";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { ActivityRow } from "../components/ActivityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import { HudPageShell, HudTabs } from "../components/HudPageShell";
import { GlassCard } from "@/components/ui/glass-card";
import { History } from "lucide-react";
import type { Agent } from "@paperclipai/shared";

type FilterTab = "All" | "Agents" | "Issues" | "Costs";

export function Activity() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [filter, setFilter] = useState<FilterTab>("All");

  useEffect(() => { setBreadcrumbs([{ label: "Activity" }]); }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: goals } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents ?? []) m.set(a.id, a);
    return m;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of issues  ?? []) m.set(`issue:${i.id}`,   i.identifier ?? i.id.slice(0, 8));
    for (const a of agents  ?? []) m.set(`agent:${a.id}`,   a.name);
    for (const p of projects ?? []) m.set(`project:${p.id}`, p.name);
    for (const g of goals   ?? []) m.set(`goal:${g.id}`,    g.title);
    return m;
  }, [issues, agents, projects, goals]);

  const entityTitleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of issues ?? []) m.set(`issue:${i.id}`, i.title);
    return m;
  }, [issues]);

  if (!selectedCompanyId) return <EmptyState icon={History} message="Select a company to view activity." />;
  if (isLoading) return <PageSkeleton variant="list" />;

  const TABS: FilterTab[] = ["All", "Agents", "Issues", "Costs"];
  const tabItems = TABS.map((t) => ({ key: t, label: t }));

  return (
    <HudPageShell
      icon={History}
      title="Activity Feed"
      subtitle={`${data?.length ?? 0} events`}
      tabs={<HudTabs tabs={tabItems} value={filter} onChange={(k) => setFilter(k as FilterTab)} />}
    >
      {error && <p className="text-xs text-destructive font-mono">{(error as Error).message}</p>}

      {data?.length === 0 && <EmptyState icon={History} message="No activity yet." />}

      {data && data.length > 0 && (
        <GlassCard className="overflow-hidden">
          <div className="divide-y divide-border/50">
            {data.map((event) => (
              <ActivityRow
                key={event.id}
                event={event}
                agentMap={agentMap}
                entityNameMap={entityNameMap}
                entityTitleMap={entityTitleMap}
                className="p-4 hover:bg-white/[0.02] transition-colors"
              />
            ))}
          </div>
        </GlassCard>
      )}
    </HudPageShell>
  );
}
