import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { useDialog } from "../context/DialogContext";
import { useToast } from "../context/ToastContext";
import { cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { HudPageShell, HudButton } from "../components/HudPageShell";
import { GlassCard } from "@/components/ui/glass-card";
import { CircleDot, Plus, List, Columns3, Search } from "lucide-react";

const GOLD = "#C9A84C";
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
  const { pushToast } = useToast();
  const [search, setSearch] = useState(initialSearch);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isBulkSelect, setIsBulkSelect] = useState(false);
  const [selectedIssues, setSelectedIssues] = useState(new Set<string>());

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

  function toggleIssueSelection(issueId: string) {
    setSelectedIssues(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
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
    <HudPageShell
      icon={CircleDot}
      title="Issues"
      subtitle={`${filtered.length} issue${filtered.length !== 1 ? "s" : ""}`}
      action={
        <div className="flex items-center gap-2">
          {/* View mode toggles */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${GOLD}33` }}>
            {(["list", "board"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="flex items-center justify-center w-7 h-7 transition-all"
                style={{
                  background: viewMode === mode ? `${GOLD}22` : "transparent",
                  color: viewMode === mode ? GOLD : "rgba(255,255,255,0.4)",
                }}
              >
                {mode === "list" ? <List className="h-3.5 w-3.5" /> : <Columns3 className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
          <HudButton
            className={isBulkSelect ? "bg-primary-dark text-primary-foreground" : ""}
            onClick={() => {
              setIsBulkSelect(!isBulkSelect);
              setSelectedIssues(new Set());
            }}
          >
            BULK SELECT
          </HudButton>
          <HudButton onClick={() => openNewIssue()}>
            <Plus className="h-3 w-3" /> New Issue
          </HudButton>
        </div>
      }
      tabs={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" style={{ color: "rgba(255,255,255,0.3)" }} />
          <input
            placeholder="Search issues…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full max-w-xs h-7 pl-7 pr-3 rounded-lg text-xs bg-transparent outline-none"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: `1px solid rgba(255,255,255,0.1)`,
              color: "rgba(255,255,255,0.8)",
              fontFamily: "monospace",
            }}
          />
        </div>
      }
    >
      {isLoading && <PageSkeleton variant="issues-list" />}
      {error && <p className="text-xs text-destructive font-mono">{error.message}</p>}

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
          isBulkSelect={isBulkSelect}
          selectedIssues={selectedIssues}
          onToggleIssueSelection={toggleIssueSelection}
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
      <AnimatePresence>
        {isBulkSelect && selectedIssues.size > 0 && (
            <motion.div
                className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
            >
                <GlassCard className="flex items-center gap-4 p-3">
                    <span className="text-sm font-semibold">{selectedIssues.size} selected</span>
                    <HudButton className="bg-primary-dark text-primary-foreground" onClick={() => {
                        selectedIssues.forEach(id => onUpdateIssue?.(id, { status: "done" }));
                        setSelectedIssues(new Set());
                    }}>
                        Mark Done
                    </HudButton>
                    <HudButton
                        onClick={() => pushToast({ title: "Coming Soon", body: "Bulk-assigning agents will be available shortly." })}
                    >
                        Assign Agent
                    </HudButton>
                </GlassCard>
            </motion.div>
        )}
      </AnimatePresence>
    </HudPageShell>
  );
}
