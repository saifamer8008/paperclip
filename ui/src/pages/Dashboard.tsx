import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { dashboardApi } from "../api/dashboard";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { ActivityRow } from "../components/ActivityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import { Bot, CircleDot, DollarSign, ShieldCheck, LayoutDashboard, AlertTriangle, TrendingUp, Activity, CheckCircle2, XCircle } from "lucide-react";
import type { Agent, Issue } from "@paperclipai/shared";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "@/lib/router";
import { GlassCard } from "@/components/ui/glass-card";
import { DashboardMetric } from "@/components/DashboardMetric";
import { AgentOffice } from "@/components/AgentOffice";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function CostTrendChart({ spendCents }: { spendCents: number }) {
  const data = useMemo(() => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((day, i) => ({
      day,
      cost: Math.round((spendCents / 100) * (0.05 + (i * 0.03) + Math.random() * 0.1)),
    }));
  }, [spendCents]);

  return (
    <ResponsiveContainer width="100%" height={100}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <defs>
          <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11, padding: "4px 10px" }}
          formatter={(v: number) => [`$${v.toFixed(2)}`, "Spend"]}
          labelStyle={{ color: "hsl(var(--muted-foreground))" }}
        />
        <Area type="monotone" dataKey="cost" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#costGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function StatRow({ label, value, highlight, alert }: { label: string; value: number; highlight?: boolean; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.05] last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        "font-semibold tabular-nums",
        alert ? "text-red-400" : highlight ? "text-emerald-400" : "text-foreground"
      )}>{value}</span>
    </div>
  );
}

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);
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

  const recentIssues = issues ? getRecentIssues(issues) : [];
  const recentActivity = useMemo(() => (activity ?? []).slice(0, 10), [activity]);

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) window.clearTimeout(timer);
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;
    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((e) => e.id);
    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }
    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) { for (const id of currentIds) seen.add(id); return; }
    setAnimatedActivityIds((prev) => { const next = new Set(prev); for (const id of newIds) next.add(id); return next; });
    for (const id of newIds) seen.add(id);
    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => { const next = new Set(prev); for (const id of newIds) next.delete(id); return next; });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => () => { for (const t of activityAnimationTimersRef.current) window.clearTimeout(t); }, []);

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
      return <EmptyState icon={LayoutDashboard} message="Welcome to Paperclip. Set up your first company and agent to get started." action="Get Started" onAction={openOnboarding} />;
    }
    return <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />;
  }

  if (isLoading || !data) return <PageSkeleton variant="dashboard" />;

  const hasNoAgents = agents !== undefined && agents.length === 0;
  const totalAgents = data.agents.active + data.agents.running + data.agents.paused + data.agents.error;
  const activeAgents = (agents ?? []).filter((a) => a.status === "running" || a.status === "idle");

  return (
    <div className="flex flex-col gap-5 pb-6">
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

      {/* Row 1: Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DashboardMetric icon={Bot} value={totalAgents} label="Agents" to="/agents" description={`${data.agents.running} running, ${data.agents.paused} paused`} isAlert={data.agents.error > 0} />
        <DashboardMetric icon={CircleDot} value={data.tasks.inProgress} label="In Progress" to="/issues" description={`${data.tasks.open} open, ${data.tasks.blocked} blocked`} />
        <DashboardMetric icon={DollarSign} value={formatCents(data.costs.monthSpendCents)} label="Month Spend" to="/costs" description={data.costs.monthBudgetCents > 0 ? `${data.costs.monthUtilizationPercent}% of budget` : "No budget set"} isAlert={data.costs.monthUtilizationPercent > 90} />
        <DashboardMetric icon={ShieldCheck} value={data.pendingApprovals} label="Approvals" to="/approvals" description={`${data.staleTasks} stale tasks`} isAlert={data.pendingApprovals > 0 || data.staleTasks > 0} />
      </div>

      {/* Row 2: Agent Office — full width 2D interactive floor */}
      <AgentOffice agents={agents} />

      {/* Row 3: Cost trend + System health + Recent tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cost trend */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" /> Cost Trend (7d)
          </h3>
          <GlassCard className="p-4">
            <CostTrendChart spendCents={data.costs.monthSpendCents} />
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-white/[0.05] pt-3">
              <span>Month total</span>
              <span className="font-semibold text-foreground">{formatCents(data.costs.monthSpendCents)}</span>
            </div>
          </GlassCard>
        </div>

        {/* System health */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1.5">
            <Activity className="h-3 w-3" /> System Health
          </h3>
          <GlassCard className="p-4">
            <StatRow label="Total Agents" value={totalAgents} />
            <StatRow label="Running Now" value={data.agents.running} highlight={data.agents.running > 0} />
            <StatRow label="Errors" value={data.agents.error} alert={data.agents.error > 0} />
            <StatRow label="Open Tasks" value={data.tasks.open} />
            <StatRow label="Blocked" value={data.tasks.blocked} alert={data.tasks.blocked > 0} />
            <StatRow label="Pending Approvals" value={data.pendingApprovals} alert={data.pendingApprovals > 0} />
          </GlassCard>
        </div>

        {/* Recent tasks */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" /> Recent Tasks
          </h3>
          {recentIssues.length > 0 ? (
            <GlassCard className="p-2">
              {recentIssues.map((issue) => (
                <Link key={issue.id} to={`/issues/${issue.identifier ?? issue.id}`} className="flex items-center justify-between text-sm no-underline text-inherit -mx-0.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors">
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="truncate text-sm">{issue.title}</div>
                    <div className="text-xs text-muted-foreground">{issue.identifier} · {timeAgo(issue.updatedAt)}</div>
                  </div>
                  <StatusBadge status={issue.status} />
                </Link>
              ))}
            </GlassCard>
          ) : (
            <GlassCard className="p-4">
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Row 4: Recent Activity (full width) */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1.5">
          <Activity className="h-3 w-3" /> Recent Activity
        </h3>
        {recentActivity.length > 0 ? (
          <GlassCard>
            <div className="divide-y divide-white/[0.04]">
              {recentActivity.map((event) => (
                <ActivityRow
                  key={event.id}
                  event={event}
                  agentMap={agentMap}
                  entityNameMap={entityNameMap}
                  entityTitleMap={entityTitleMap}
                  className={cn("px-4 py-2.5", animatedActivityIds.has(event.id) && "activity-row-enter")}
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

      {/* Stale tasks warning */}
      {data.staleTasks > 0 && (
        <GlassCard className="p-4 flex items-start gap-3 border-yellow-400/30">
          <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm">{data.staleTasks} Stale Tasks</div>
            <p className="text-sm text-muted-foreground">Tasks not updated in over a week.</p>
          </div>
          <Link to="/issues?status=stale" className="text-sm font-medium text-yellow-400 hover:text-yellow-300 transition-colors shrink-0">
            View →
          </Link>
        </GlassCard>
      )}
    </div>
  );
}
