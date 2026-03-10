import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { dashboardApi } from "../api/dashboard";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { ActivityRow } from "../components/ActivityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import { Bot, CircleDot, DollarSign, ShieldCheck, LayoutDashboard, AlertTriangle } from "lucide-react";
import type { Agent, Issue } from "@paperclipai/shared";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "@/lib/router";
import { GlassCard } from "@/components/ui/glass-card";
import { DashboardMetric } from "@/components/DashboardMetric";
import { LatestRunLog } from "@/components/LatestRunLog";

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);
}

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedActivityRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activity } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
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
  
  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 5000,
  });

  const recentIssues = issues ? getRecentIssues(issues) : [];
  const recentActivity = useMemo(() => (activity ?? []).slice(0, 8), [activity]);

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) {
      window.clearTimeout(timer);
    }
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;

    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((event) => event.id);

    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }

    setAnimatedActivityIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });

    for (const id of newIds) seen.add(id);

    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to Paperclip. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading || !data) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;
  const totalAgents = data.agents.active + data.agents.running + data.agents.paused + data.agents.error;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left rail */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {hasNoAgents && (
          <GlassCard className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2.5">
              <Bot className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-sm">You have no agents.</p>
            </div>
            <button
              onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
              className="text-sm font-medium text-primary hover:text-primary/80 underline underline-offset-2 shrink-0"
            >
              Create one here
            </button>
          </GlassCard>
        )}

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardMetric
            icon={Bot}
            value={totalAgents}
            label="Agents"
            to="/agents"
            description={`${data.agents.running} running, ${data.agents.paused} paused`}
            isAlert={data.agents.error > 0}
          />
          <DashboardMetric
            icon={CircleDot}
            value={data.tasks.inProgress}
            label="In Progress"
            to="/issues"
            description={`${data.tasks.open} open, ${data.tasks.blocked} blocked`}
          />
          <DashboardMetric
            icon={DollarSign}
            value={formatCents(data.costs.monthSpendCents)}
            label="Month Spend"
            to="/costs"
            description={
              data.costs.monthBudgetCents > 0
                ? `${data.costs.monthUtilizationPercent}% of budget`
                : "No budget set"
            }
            isAlert={data.costs.monthUtilizationPercent > 90}
          />
          <DashboardMetric
            icon={ShieldCheck}
            value={data.pendingApprovals}
            label="Approvals"
            to="/approvals"
            description={`${data.staleTasks} stale tasks`}
            isAlert={data.pendingApprovals > 0 || data.staleTasks > 0}
          />
        </div>

        <LatestRunLog runs={runs} />
      </div>

      {/* Right rail */}
      <div className="col-span-12 lg:col-span-4 space-y-6">
        {/* Active Agents */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Active Agents
          </h3>
          <GlassCard className="p-4">
            {agents && agents.length > 0 ? (
              <div className="space-y-3">
                {agents
                  .filter((a) => a.status !== "inactive")
                  .slice(0, 10)
                  .map((agent) => (
                    <Link
                      key={agent.id}
                      to={`/agents/${agent.id}`}
                      className="flex items-center justify-between no-underline text-inherit glass-hover -m-2 p-2 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        <span className="font-medium">{agent.name}</span>
                      </div>
                      <StatusBadge status={agent.status} />
                    </Link>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active agents.</p>
            )}
          </GlassCard>
        </div>

        {/* Recent Tasks */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Tasks
          </h3>
          {recentIssues.length > 0 ? (
            <GlassCard className="p-2">
              <div className="space-y-1">
                {recentIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/issues/${issue.identifier ?? issue.id}`}
                    className="flex items-center justify-between text-sm no-underline text-inherit glass-hover p-2 rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="truncate">{issue.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {issue.identifier} &middot; {timeAgo(issue.updatedAt)}
                      </div>
                    </div>
                    <StatusBadge status={issue.status} />
                  </Link>
                ))}
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-4">
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            </GlassCard>
          )}
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Activity
          </h3>
          {recentActivity.length > 0 ? (
            <GlassCard>
              <div className="divide-y divide-border/50">
                {recentActivity.map((event) => (
                  <ActivityRow
                    key={event.id}
                    event={event}
                    agentMap={agentMap}
                    entityNameMap={entityNameMap}
                    entityTitleMap={entityTitleMap}
                    className={cn(
                      "p-3",
                      animatedActivityIds.has(event.id) && "activity-row-enter"
                    )}
                  />
                ))}
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-4">
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            </GlassCard>
          )}
        </div>

        {/* Stale Tasks */}
        {data.staleTasks > 0 && (
          <GlassCard className="p-4 flex items-start gap-3 border-yellow-400/60">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
            <div>
              <div className="font-semibold">{data.staleTasks} Stale Tasks</div>
              <p className="text-sm text-muted-foreground">
                Tasks that have not been updated in over a week.
              </p>
              <Link
                to="/issues?status=stale"
                className="text-sm font-medium text-yellow-400 hover:text-yellow-300 transition-colors mt-2 block"
              >
                View stale tasks
              </Link>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
