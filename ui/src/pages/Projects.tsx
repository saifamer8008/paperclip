import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Hexagon, Plus, CircleDotDashed, ExternalLink } from "lucide-react";

import { projectsApi } from "../api/projects";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { HudPageShell, HudButton } from "../components/HudPageShell";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/StatusBadge";
import { notionApi, type NotionDeal } from "../api/notion";
import type { Project } from "@paperclipai/shared";

const GOLD = "#C9A84C";
const DEAL_COLOR: Record<string, string> = {
  Yes: "#34d399", Active: "#34d399", "In Progress": "#fbbf24",
  "Dormant / Parked": "#374151", Dormant: "#374151",
};

function NotionPipelineSidebar() {
  const { data, isLoading } = useQuery({
    queryKey: ["notion-summary"],
    queryFn: () => notionApi.summary(),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const active = data?.deals.filter(d => !d.status.toLowerCase().includes("dormant")) ?? [];
  const dormant = data?.deals.filter(d => d.status.toLowerCase().includes("dormant")) ?? [];

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
          Notion · Pipeline
        </span>
        {data && (
          <span className="ml-auto text-[8px] font-mono text-white/25">{active.length} active</span>
        )}
      </div>
      {isLoading && <p className="text-[9px] font-mono text-white/25 px-3 py-2 animate-pulse">Loading…</p>}
      {active.length > 0 && (
        <>
          <div className="px-3 pt-2 pb-0.5 text-[8px] font-black tracking-widest text-white/30 uppercase" style={{ fontFamily: "monospace" }}>
            Active
          </div>
          {active.map((d: NotionDeal) => {
            const c = DEAL_COLOR[d.status] ?? "#34d399";
            return (
              <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="no-underline block">
                <div className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors group">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 4px ${c}` }} />
                  <span className="flex-1 text-[11px] text-white/65 group-hover:text-white/90 truncate transition-colors">{d.name}</span>
                  <ExternalLink className="w-2.5 h-2.5 text-white/20 group-hover:text-white/50 shrink-0 transition-colors" />
                </div>
              </a>
            );
          })}
        </>
      )}
      {dormant.length > 0 && (
        <>
          <div className="px-3 pt-2 pb-0.5 text-[8px] font-black tracking-widest text-white/20 uppercase" style={{ fontFamily: "monospace" }}>
            Parked
          </div>
          {dormant.map((d: NotionDeal) => (
            <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="no-underline block">
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors group opacity-40">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                <span className="flex-1 text-[10px] text-white/50 truncate">{d.name}</span>
              </div>
            </a>
          ))}
        </>
      )}
    </div>
  );
}

function ProjectCard({ project, openIssueCount }: { project: Project; openIssueCount: number }) {
  return (
    <GlassCard className="p-4 flex flex-col gap-3 hover:bg-white/[0.03] transition-colors">
      <Link to={`/projects/${project.id}`} className="no-underline text-inherit">
        <h3 className="font-bold text-sm truncate">{project.name}</h3>
        {project.description && (
          <p className="text-xs text-white/50 mt-1 line-clamp-2">{project.description}</p>
        )}
      </Link>

      <div className="mt-auto flex items-center justify-between">
        <StatusBadge status={project.status} />
        <Link
          to={`/issues?project=${project.id}`}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 no-underline transition-colors"
        >
          <CircleDotDashed className="h-3 w-3" />
          <span>{openIssueCount} open</span>
        </Link>
      </div>
    </GlassCard>
  );
}

export function Projects() {
  const { selectedCompanyId } = useCompany();
  const { openNewProject } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => { setBreadcrumbs([{ label: "Projects" }]); }, [setBreadcrumbs]);

  const { data: projects, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const openIssueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of issues ?? []) {
      if (
        issue.projectId &&
        issue.status !== "done" &&
        issue.status !== "cancelled"
      ) {
        counts.set(issue.projectId, (counts.get(issue.projectId) ?? 0) + 1);
      }
    }
    return counts;
  }, [issues, projects]);

  if (!selectedCompanyId) return <EmptyState icon={Hexagon} message="Select a company to view projects." />;
  if (projectsLoading) return <PageSkeleton variant="list" />;

  return (
    <HudPageShell
      icon={Hexagon}
      title="Projects"
      subtitle={`${projects?.length ?? 0} projects`}
      action={
        <HudButton onClick={openNewProject}>
          <Plus className="h-3 w-3" /> Add Project
        </HudButton>
      }
    >
      {projectsError && <p className="text-xs text-destructive font-mono">{(projectsError as Error).message}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">
        <div>
          {(!projects || projects.length === 0) && (
            <EmptyState icon={Hexagon} message="No projects yet." action="Add Project" onAction={openNewProject} />
          )}
          {projects && projects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  openIssueCount={openIssueCounts.get(project.id) ?? 0}
                />
              ))}
            </div>
          )}
        </div>
        <NotionPipelineSidebar />
      </div>
    </HudPageShell>
  );
}
