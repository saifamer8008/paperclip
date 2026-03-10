import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { goalsApi } from "../api/goals";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { GoalTree } from "../components/GoalTree";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { HudPageShell, HudButton } from "../components/HudPageShell";
import { Target, Plus } from "lucide-react";

export function Goals() {
  const { selectedCompanyId } = useCompany();
  const { openNewGoal } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Goals" }]);
  }, [setBreadcrumbs]);

  const { data: goals, isLoading, error } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Target} message="Select a company to view goals." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

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
      {goals?.length === 0 && (
        <EmptyState icon={Target} message="No goals yet." action="Add Goal" onAction={() => openNewGoal()} />
      )}
      {goals && goals.length > 0 && (
        <GoalTree goals={goals} goalLink={(goal) => `/goals/${goal.id}`} />
      )}
    </HudPageShell>
  );
}
