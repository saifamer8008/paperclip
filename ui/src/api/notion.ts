import { api } from "./client";

export interface NotionTask {
  id: string;
  url: string;
  name: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  assignedTo?: string[];
  assignee?: string;
  blockers?: string;
  category?: string;
}

export interface NotionGoal {
  id: string;
  url: string;
  name: string;
  status: string;
}

export interface NotionDeal {
  id: string;
  url: string;
  name: string;
  status: string;
}

export interface NotionSummary {
  tasks: NotionTask[];
  goals: NotionGoal[];
  deals: NotionDeal[];
  fetchedAt: string;
}

export const notionApi = {
  summary: () => api.get<NotionSummary>("/notion/summary"),
};
