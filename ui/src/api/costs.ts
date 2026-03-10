import type { CostSummary, CostByAgent } from "@paperclipai/shared";
import { api } from "./client";

export interface CostByProject {
  projectId: string | null;
  projectName: string | null;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
}

function dateParams(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export interface CostByDay {
  date: string;      // "Mar 1"
  costCents: number;
  cost: number;      // costCents / 100 (for recharts)
}

export const costsApi = {
  summary: (companyId: string, from?: string, to?: string) =>
    api.get<CostSummary>(`/companies/${companyId}/costs/summary${dateParams(from, to)}`),
  byAgent: (companyId: string, from?: string, to?: string) =>
    api.get<CostByAgent[]>(`/companies/${companyId}/costs/by-agent${dateParams(from, to)}`),
  byProject: (companyId: string, from?: string, to?: string) =>
    api.get<CostByProject[]>(`/companies/${companyId}/costs/by-project${dateParams(from, to)}`),
  byDay: (companyId: string, days?: number, from?: string, to?: string) => {
    const qs = dateParams(from, to);
    const sep = qs ? "&" : "?";
    return api.get<CostByDay[]>(`/companies/${companyId}/costs/by-day?days=${days ?? 7}${qs ? sep + qs.slice(1) : ""}`);
  },
};
