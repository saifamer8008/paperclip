import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Hexagon, Plus, CircleDotDashed } from "lucide-react";

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
import type { Project } from "@paperclipai/shared";

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

      {(!projects || projects.length === 0) && (
        <EmptyState icon={Hexagon} message="No projects yet." action="Add Project" onAction={openNewProject} />
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              openIssueCount={openIssueCounts.get(project.id) ?? 0}
            />
          ))}
        </div>
      )}
    </HudPageShell>
  );
}
