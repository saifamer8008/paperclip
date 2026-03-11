import { Router } from "express";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";

// DB IDs — hardcoded from discovery (Saif's workspace)
const DB = {
  executionTasks:  "28d580fa-60aa-80ec-8e85-ef673136b107",
  companyGoals:    "28d580fa-60aa-8116-93c0-e6cf4b2ab479",
  pipelineDeals:   "28d580fa-60aa-80f4-be48-fce42a320f97",
  kpiTracker:      "2f4580fa-60aa-80a4-8106-f074b86f02b9",
};

function getNotionKey(): string | null {
  try {
    return readFileSync(join(homedir(), ".config/notion/api_key"), "utf8").trim();
  } catch {
    return null;
  }
}

async function queryDB(key: string, dbId: string, body: object) {
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion API error ${res.status}`);
  return res.json() as Promise<{ results: NotionPage[] }>;
}

interface NotionPage {
  id: string;
  properties: Record<string, NotionProp>;
  url: string;
}

interface NotionProp {
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  status?: { name: string; color?: string };
  select?: { name: string; color?: string };
  multi_select?: Array<{ name: string }>;
  date?: { start?: string; end?: string };
  people?: Array<{ name: string; id: string }>;
  number?: number;
  checkbox?: boolean;
  url?: string;
}

function propText(prop?: NotionProp): string {
  if (!prop) return "";
  if (prop.title)      return prop.title.map(t => t.plain_text).join("");
  if (prop.rich_text)  return prop.rich_text.map(t => t.plain_text).join("");
  if (prop.status)     return prop.status.name;
  if (prop.select)     return prop.select.name;
  if (prop.number != null) return String(prop.number);
  if (prop.checkbox != null) return prop.checkbox ? "yes" : "no";
  if (prop.url)        return prop.url;
  if (prop.date)       return prop.date.start ?? "";
  if (prop.people)     return prop.people.map(p => p.name).join(", ");
  if (prop.multi_select) return prop.multi_select.map(s => s.name).join(", ");
  return "";
}

export function notionRoutes() {
  const router = Router();

  // GET /api/notion/summary — tasks + goals + deals in one call
  router.get("/summary", async (_req, res) => {
    const key = getNotionKey();
    if (!key) {
      res.status(503).json({ error: "Notion API key not configured" });
      return;
    }

    try {
      const [tasksData, goalsData, dealsData] = await Promise.all([
        queryDB(key, DB.executionTasks, {
          filter: {
            or: [
              { property: "Status", status: { equals: "In Progress" } },
              { property: "Status", status: { equals: "Not started" } },
            ],
          },
          sorts: [{ property: "Priority", direction: "ascending" }],
          page_size: 15,
        }),
        queryDB(key, DB.companyGoals, { page_size: 10 }),
        queryDB(key, DB.pipelineDeals, {
          filter: { property: "Active?", checkbox: { equals: true } },
          page_size: 10,
        }),
      ]);

      // Normalise tasks
      const tasks = tasksData.results.map((p) => {
        const props = p.properties;
        return {
          id: p.id,
          url: p.url,
          name: propText(props["Task Name"]),
          status: propText(props["Status"]),
          priority: propText(props["Priority"]),
          dueDate: (props["Due Date"]?.date?.start) ?? null,
          assignedTo: (props["Assigned To"]?.people ?? []).map(pp => pp.name),
          category: propText(props["Category"]),
        };
      }).filter(t => t.name);

      // Normalise goals
      const goals = goalsData.results.map((p) => {
        const props = p.properties;
        // Find title field dynamically
        const nameField = Object.values(props).find(v => v.type === "title");
        const name = propText(nameField);
        const statusField = Object.entries(props).find(([k]) =>
          ["Status","status","Priority","priority"].includes(k)
        );
        const status = statusField ? propText(statusField[1]) : "";
        return { id: p.id, url: p.url, name, status };
      }).filter(g => g.name);

      // Normalise deals — no Active? checkbox, just return all
      const deals = dealsData.results.length > 0
        ? dealsData.results
        : (await queryDB(key, DB.pipelineDeals, { page_size: 10 })).results;

      const normalDeals = deals.map((p) => {
        const props = p.properties;
        const nameField = Object.values(props).find(v => v.type === "title");
        const name = propText(nameField);
        const statusField = Object.values(props).find(v => v.type === "select" || v.type === "status");
        const status = statusField ? propText(statusField) : "";
        return { id: p.id, url: p.url, name, status };
      }).filter(d => d.name);

      res.json({ tasks, goals, deals: normalDeals, fetchedAt: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Notion fetch failed" });
    }
  });

  return router;
}
