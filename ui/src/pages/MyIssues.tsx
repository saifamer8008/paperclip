import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { HudPageShell } from "../components/HudPageShell";
import { formatDate } from "../lib/utils";
import { ListTodo } from "lucide-react";

export function MyIssues() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "My Issues" }]);
  }, [setBreadcrumbs]);

  const { data: issues, isLoading, error } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={ListTodo} message="Select a company to view your issues." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  // Show issues that are not assigned (user-created or unassigned)
  const myIssues = (issues ?? []).filter(
    (i) => !i.assigneeAgentId && !["done", "cancelled"].includes(i.status)
  );

  return (
    <HudPageShell
      icon={ListTodo}
      title="My Issues"
      subtitle={`${myIssues.length} open issue${myIssues.length !== 1 ? "s" : ""}`}
    >
      {error && <p className="text-xs text-destructive font-mono">{(error as Error).message}</p>}
      {myIssues.length === 0 && (
        <EmptyState icon={ListTodo} message="No issues assigned to you." />
      )}
      {myIssues.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {myIssues.map((issue) => (
            <EntityRow
              key={issue.id}
              identifier={issue.identifier ?? issue.id.slice(0, 8)}
              title={issue.title}
              to={`/issues/${issue.identifier ?? issue.id}`}
              leading={
                <>
                  <PriorityIcon priority={issue.priority} />
                  <StatusIcon status={issue.status} />
                </>
              }
              trailing={
                <span className="text-[10px] text-white/40 font-mono">{formatDate(issue.createdAt)}</span>
              }
            />
          ))}
        </div>
      )}
    </HudPageShell>
  );
}
