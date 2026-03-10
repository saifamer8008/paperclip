import { useEffect } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { CompanyRail } from "./CompanyRail";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { PropertiesPanel } from "./PropertiesPanel";
import { CommandPalette } from "./CommandPalette";
import { NewIssueDialog } from "./NewIssueDialog";
import { NewProjectDialog } from "./NewProjectDialog";
import { NewGoalDialog } from "./NewGoalDialog";
import { NewAgentDialog } from "./NewAgentDialog";
import { ToastViewport } from "./ToastViewport";
import { useDialog } from "@/context/DialogContext";
import { useCompany } from "@/context/CompanyContext";
import { healthApi } from "@/api/health";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

export function Layout() {
  const { openOnboarding } = useDialog();
  const { companies, loading: companiesLoading, selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { companyPrefix } = useParams<{ companyPrefix: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });

  useEffect(() => {
    if (companiesLoading || health?.deploymentMode === "authenticated" || companies.length > 0) return;
    openOnboarding();
  }, [companies.length, companiesLoading, openOnboarding, health?.deploymentMode]);

  useEffect(() => {
    if (!companyPrefix || companiesLoading || companies.length === 0) return;

    const matched = companies.find((company) => company.issuePrefix.toUpperCase() === companyPrefix.toUpperCase());

    if (!matched) {
        const fallback = selectedCompanyId ? companies.find((c) => c.id === selectedCompanyId) : companies[0];
        if (fallback) {
            navigate(`/${fallback.issuePrefix}/dashboard`, { replace: true });
        }
        return;
    }

    if (companyPrefix !== matched.issuePrefix) {
        const suffix = location.pathname.replace(/^\/[^/]+/, "");
        navigate(`/${matched.issuePrefix}${suffix}${location.search}`, { replace: true });
        return;
    }

    if (selectedCompanyId !== matched.id) {
        setSelectedCompanyId(matched.id, { source: "route_sync" });
    }
}, [companyPrefix, companies, companiesLoading, location.pathname, location.search, navigate, selectedCompanyId, setSelectedCompanyId]);

  return (
    <div className="flex h-dvh bg-background text-foreground overflow-hidden">
        <CompanyRail />
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
            <Header />
            <div className="flex flex-1 min-h-0">
                <main id="main-content" tabIndex={-1} className={cn("flex-1 overflow-auto p-4 md:p-6")}>
                    <Outlet />
                </main>
                <PropertiesPanel />
            </div>
        </div>

        <CommandPalette />
        <NewIssueDialog />
        <NewProjectDialog />
        <NewGoalDialog />
        <NewAgentDialog />
        <ToastViewport />
    </div>
  );
}
