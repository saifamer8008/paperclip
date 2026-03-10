import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EntityRow } from "../components/EntityRow";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { HudPageShell, HudButton } from "../components/HudPageShell";
import { formatDate, projectUrl } from "../lib/utils";
import { Hexagon, Plus } from "lucide-react";

export function Projects() {
  const { selectedCompanyId } = useCompany();
  const { openNewProject } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => { setBreadcrumbs([{ label: "Projects" }]); }, [setBreadcrumbs]);

  const { data: projects, isLoading, error } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) return <EmptyState icon={Hexagon} message="Select a company to view projects." />;
  if (isLoading) return <PageSkeleton variant="list" />;

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
      {error && <p className="text-xs text-destructive font-mono">{(error as Error).message}</p>}

      {projects?.length === 0 && (
        <EmptyState icon={Hexagon} message="No projects yet." action="Add Project" onAction={openNewProject} />
      )}

      {projects && projects.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {projects.map((project) => (
            <EntityRow
              key={project.id}
              title={project.name}
              subtitle={project.description ?? undefined}
              to={projectUrl(project)}
              trailing={
                <div className="flex items-center gap-3">
                  {project.targetDate && (
                    <span className="text-[10px] text-white/40 font-mono">{formatDate(project.targetDate)}</span>
                  )}
                  <StatusBadge status={project.status} />
                </div>
              }
            />
          ))}
        </div>
      )}
    </HudPageShell>
  );
}
