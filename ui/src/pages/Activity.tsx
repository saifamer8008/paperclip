import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, User, Tag } from "lucide-react";

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
import { HudPageShell } from "../components/HudPageShell";
import { GlassCard } from "@/components/ui/glass-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Agent, ActivityEvent } from "@paperclipai/shared";

const GOLD = "#C9A84C";

type AgentFilter = "all" | string;
type TypeFilter = "all" | string;

const EVENT_TYPES: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All Event Types" },
  { value: "agent_created", label: "Agent Created" },
  { value: "agent_status_changed", label: "Agent Status Changed" },
  { value: "issue_created", label: "Issue Created" },
  { value: "issue_status_changed", label: "Issue Status Changed" },
  { value: "issue_assigned", label: "Issue Assigned" },
];

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "TODAY";
  if (isSameDay(date, yesterday)) return "YESTERDAY";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDayKey(createdAt: Date | string): string {
  const d = new Date(createdAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function Activity() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

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
    for (const i of issues   ?? []) m.set(`issue:${i.id}`,   i.identifier ?? i.id.slice(0, 8));
    for (const a of agents   ?? []) m.set(`agent:${a.id}`,   a.name);
    for (const p of projects ?? []) m.set(`project:${p.id}`, p.name);
    for (const g of goals    ?? []) m.set(`goal:${g.id}`,    g.title);
    return m;
  }, [issues, agents, projects, goals]);

  const entityTitleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of issues ?? []) m.set(`issue:${i.id}`, i.title);
    return m;
  }, [issues]);

  const filteredData = useMemo(() => {
    return (data ?? [])
      .filter(event => agentFilter === "all" || event.agentId === agentFilter)
      .filter(event => typeFilter === "all" || event.action === typeFilter);
  }, [data, agentFilter, typeFilter]);

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, ActivityEvent[]>();
    for (const event of filteredData) {
      const key = getDayKey(event.createdAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(event);
    }
    // Sort keys descending
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredData]);

  if (!selectedCompanyId) return <EmptyState icon={History} message="Select a company to view activity." />;
  if (isLoading) return <PageSkeleton variant="list" />;

  return (
    <HudPageShell
      icon={History}
      title="Activity Feed"
      subtitle={`${filteredData.length} events`}
    >
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <Select value={agentFilter} onValueChange={(v) => setAgentFilter(v)}>
          <SelectTrigger className="w-[180px] bg-transparent border-white/10 text-xs">
            <User className="h-3 w-3 mr-1.5 text-white/50" />
            <SelectValue placeholder="Filter by agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {(agents ?? []).map(agent => (
              <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
          <SelectTrigger className="w-[200px] bg-transparent border-white/10 text-xs">
            <Tag className="h-3 w-3 mr-1.5 text-white/50" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map(et => (
              <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-xs text-destructive font-mono">{(error as Error).message}</p>}

      {groupedByDay.length === 0 && !isLoading && (
        <EmptyState icon={History} message="No matching activity found." />
      )}

      <div className="space-y-4">
        {groupedByDay.map(([dayKey, events]) => (
          <div key={dayKey}>
            <h3 className="text-[10px] font-black tracking-widest uppercase mb-2" style={{ color: GOLD }}>
              {formatDayLabel(dayKey)}
            </h3>
            <GlassCard className="overflow-hidden">
              <div className="divide-y divide-border/50">
                {events.map((event) => (
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
          </div>
        ))}
      </div>
    </HudPageShell>
  );
}
