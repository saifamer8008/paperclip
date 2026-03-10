import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { useDialog } from "../context/DialogContext";
import { cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CircleDot, Plus, List, Columns3 } from "lucide-react";
import { KanbanBoard } from "./KanbanBoard";
import type { Issue, Agent } from "@paperclipai/shared";
import { motion, AnimatePresence } from "framer-motion";

interface IssuesListProps {
  issues: Issue[];
  isLoading: boolean;
  error: Error | null;
  agents?: Agent[];
  liveIssueIds?: Set<string>;
  projectId?: string;
  viewStateKey?: string;
  initialAssignees?: string[];
  initialSearch?: string;
  onSearchChange?: (search: string) => void;
  onUpdateIssue?: (id: string, data: Record<string, unknown>) => void;
}

type ViewMode = "list" | "board";

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

export function IssuesList({
  issues,
  isLoading,
  error,
  agents,
  liveIssueIds,
  projectId: _projectId,
  viewStateKey: _viewStateKey,
  initialSearch = "",
  onSearchChange,
  onUpdateIssue,
}: IssuesListProps) {
  const { openNewIssue } = useDialog();
  const [search, setSearch] = useState(initialSearch);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const filtered = useMemo(() => {
    if (!search.trim()) return issues;
    const q = search.toLowerCase();
    return issues.filter(
      (i) =>
        i.title?.toLowerCase().includes(q) ||
        i.identifier?.toLowerCase().includes(q) ||
        i.status?.toLowerCase().includes(q)
    );
  }, [issues, search]);

  function handleSearch(val: string) {
    setSearch(val);
    onSearchChange?.(val);
  }

  function agentAvatar(agentId: string | null) {
    if (!agentId || !agents) return null;
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return null;
    return (
      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0">
        {agent.name.charAt(0)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Input
            placeholder="Search issues…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-8 pl-3 pr-3 text-sm"
          />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            className="h-8 w-8 p-0"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === "board" ? "secondary" : "ghost"}
            className="h-8 w-8 p-0"
            onClick={() => setViewMode("board")}
          >
            <Columns3 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={() => openNewIssue()}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Issue
          </Button>
        </div>
      </div>

      {isLoading && <PageSkeleton variant="issues-list" />}
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState
          icon={CircleDot}
          message="No issues match the current filters or search."
          action="Create Issue"
          onAction={() => openNewIssue()}
        />
      )}

      {viewMode === "board" ? (
        <KanbanBoard
          issues={filtered}
          agents={agents}
          liveIssueIds={liveIssueIds}
          onUpdateIssue={onUpdateIssue}
        />
      ) : (
        <AnimatePresence>
          <motion.div layout className="space-y-2">
            {filtered.map((issue) => (
              <motion.div
                key={issue.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
              >
                <Link to={`/issues/${issue.identifier ?? issue.id}`} className="block no-underline">
                  <GlassCard className="p-3 flex items-center gap-3 glass-hover">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        PRIORITY_COLOR[issue.priority] ?? "bg-gray-500"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{issue.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {issue.identifier ?? issue.id.slice(0, 8)} ·{" "}
                        {timeAgo(issue.updatedAt)}
                        {liveIssueIds?.has(issue.id) && (
                          <span className="ml-2 inline-flex items-center gap-1 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            live
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={issue.status} />
                      {agentAvatar(issue.assigneeAgentId ?? null)}
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
