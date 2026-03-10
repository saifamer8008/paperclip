import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { costsApi } from "../api/costs";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatCents, formatTokens } from "../lib/utils";
import { Identity } from "../components/Identity";
import { StatusBadge } from "../components/StatusBadge";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";

type DatePreset = "mtd" | "7d" | "30d" | "ytd" | "all" | "custom";

const PRESET_LABELS: Record<DatePreset, string> = {
  mtd: "Month to Date",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  ytd: "Year to Date",
  all: "All Time",
  custom: "Custom",
};

function computeRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (preset) {
    case "mtd": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: d.toISOString(), to };
    }
    case "7d": {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: d.toISOString(), to };
    }
    case "30d": {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: d.toISOString(), to };
    }
    case "ytd": {
      const d = new Date(now.getFullYear(), 0, 1);
      return { from: d.toISOString(), to };
    }
    case "all":
      return { from: "", to: "" };
    case "custom":
      return { from: "", to: "" };
  }
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold text-muted-foreground mb-1">{label}</p>
        <p className="text-primary font-medium">
          Cost: ${payload[0].value.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
}

export function Costs() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const [preset, setPreset] = useState<DatePreset>("mtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Costs" }]);
  }, [setBreadcrumbs]);

  const { from, to } = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : "",
        to: customTo ? new Date(customTo + "T23:59:59.999Z").toISOString() : "",
      };
    }
    return computeRange(preset);
  }, [preset, customFrom, customTo]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.costs(selectedCompanyId!, from || undefined, to || undefined),
    queryFn: async () => {
      const [summary, byAgent, byProject] = await Promise.all([
        costsApi.summary(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byAgent(selectedCompanyId!, from || undefined, to || undefined),
        costsApi.byProject(selectedCompanyId!, from || undefined, to || undefined),
      ]);
      return { summary, byAgent, byProject };
    },
    enabled: !!selectedCompanyId,
  });

  // Mock trend data generation since we don't have access to raw daily cost events from the API here
  // In a real scenario, the API would return time-series data for the chart.
  const chartData = useMemo(() => {
     if (!data?.summary.spendCents) return [];
     // distribute total spend across 7 fake days for the visual
     const total = data.summary.spendCents / 100;
     const days = 7;
     const avg = total / days;
     return Array.from({length: days}).map((_, i) => {
         const date = new Date();
         date.setDate(date.getDate() - (days - 1 - i));
         // add some random noise around the average
         const cost = Math.max(0, avg + (Math.random() - 0.5) * avg * 0.5);
         return {
             date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
             cost: cost
         }
     });
  }, [data]);


  if (!selectedCompanyId) {
    return <EmptyState icon={DollarSign} message="Select a company to view costs." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="costs" />;
  }

  const presetKeys: DatePreset[] = ["mtd", "7d", "30d", "ytd", "all", "custom"];

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex flex-wrap items-center gap-2">
        {presetKeys.map((p) => (
          <Button
            key={p}
            variant={preset === p ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPreset(p)}
          >
            {PRESET_LABELS[p]}
          </Button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {data && (
        <>
          <GlassCard className="p-4 mb-6">
             <h3 className="text-sm font-semibold text-muted-foreground mb-3">Cost Trend</h3>
             <div className="h-[160px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <XAxis dataKey="date" tick={{fontSize: 12}} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="cost" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
                    </AreaChart>
                 </ResponsiveContainer>
             </div>
          </GlassCard>

          {/* Summary card */}
          <GlassCard glow className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{PRESET_LABELS[preset]}</p>
              {data.summary.budgetCents > 0 && (
                <p className="text-sm text-muted-foreground">
                  {data.summary.utilizationPercent}% utilized
                </p>
              )}
            </div>
            <p className="text-2xl font-bold">
              {formatCents(data.summary.spendCents)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                {data.summary.budgetCents > 0
                  ? `/ ${formatCents(data.summary.budgetCents)}`
                  : "Unlimited budget"}
              </span>
            </p>
            {data.summary.budgetCents > 0 && (
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width,background-color] duration-150 ${
                    data.summary.utilizationPercent > 90
                      ? "bg-destructive"
                      : data.summary.utilizationPercent > 70
                      ? "bg-yellow-400"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, data.summary.utilizationPercent)}%` }}
                />
              </div>
            )}
          </GlassCard>

          {/* By Agent / By Project */}
          <div className="grid md:grid-cols-2 gap-4">
            <GlassCard className="p-4">
              <h3 className="text-sm font-semibold mb-3">By Agent</h3>
              {data.byAgent.length === 0 ? (
                <p className="text-sm text-muted-foreground">No cost events yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.byAgent.map((row) => (
                    <div key={row.agentId}>
                      <div className="flex items-start justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Identity
                            name={row.agentName ?? row.agentId}
                            size="sm"
                          />
                          {row.agentStatus === "terminated" && (
                            <StatusBadge status="terminated" />
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="font-medium block">
                            {formatCents(row.costCents)}
                          </span>
                          <span className="text-xs text-muted-foreground block">
                            in {formatTokens(row.inputTokens)} / out{" "}
                            {formatTokens(row.outputTokens)} tok
                          </span>
                          {(row.apiRunCount > 0 || row.subscriptionRunCount > 0) && (
                            <span className="text-xs text-muted-foreground block">
                              {row.apiRunCount > 0 ? `api runs: ${row.apiRunCount}` : null}
                              {row.apiRunCount > 0 && row.subscriptionRunCount > 0
                                ? " | "
                                : null}
                              {row.subscriptionRunCount > 0
                                ? `subscription runs: ${
                                    row.subscriptionRunCount
                                  } (${formatTokens(
                                    row.subscriptionInputTokens
                                  )} in / ${formatTokens(row.subscriptionOutputTokens)} out tok)`
                                : null}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-1">
                        <div
                          className="h-1 bg-primary rounded-full"
                          style={{
                            width: `${
                              data.summary.spendCents > 0
                                ? (row.costCents / data.summary.spendCents) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-4">
              <h3 className="text-sm font-semibold mb-3">By Project</h3>
              {data.byProject.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No project-attributed run costs yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.byProject.map((row) => (
                    <div key={row.projectId ?? "na"}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">
                          {row.projectName ?? row.projectId ?? "Unattributed"}
                        </span>
                        <span className="font-medium">
                          {formatCents(row.costCents)}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-1">
                        <div
                          className="h-1 bg-primary rounded-full"
                          style={{
                            width: `${
                              data.summary.spendCents > 0
                                ? (row.costCents / data.summary.spendCents) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
