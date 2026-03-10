import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { groupBy } from "../lib/groupBy";
import { cn, timeAgo } from "../lib/utils";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CircleDot, Plus, Filter, List, Columns3, Search } from "lucide-react";
import { KanbanBoard } from "./KanbanBoard";
import type { Issue } from "@paperclipai/shared";
import { motion, AnimatePresence } from "framer-motion";

// ... (Keep all helper functions and type definitions as they are)

export function IssuesList({
  issues,
  isLoading,
  error,
  agents,
  liveIssueIds,
  projectId,
  viewStateKey,
  initialAssignees,
  initialSearch,
  onSearchChange,
  onUpdateIssue,
}: IssuesListProps) {
  const { selectedCompanyId } = useCompany();
  const { openNewIssue } = useDialog();

  // ... (Keep all state and hooks as they are)

  const priorityColor = (priority: string) => {
    switch (priority) {
        case 'urgent': return 'bg-red-500';
        case 'high': return 'bg-orange-500';
        default: return 'bg-gray-500';
    }
  };

  const agentAvatar = (agentId: string | null) => {
      if (!agentId || !agents) return null;
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return null;
      return (
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0">
              {agent.name.charAt(0)}
          </div>
      );
  }

  return (
    <div className="space-y-4">
        {/* ... (Keep toolbar JSX as is) ... */}

        {isLoading && <PageSkeleton variant="issues-list" />}
        {error && <p className="text-sm text-destructive">{error.message}</p>}

        {!isLoading && filtered.length === 0 && viewState.viewMode === "list" && (
            <EmptyState
            icon={CircleDot}
            message="No issues match the current filters or search."
            action="Create Issue"
            onAction={() => openNewIssue(newIssueDefaults())}
            />
        )}

        {viewState.viewMode === "board" ? (
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
                                    <span className={cn("w-2 h-2 rounded-full shrink-0", priorityColor(issue.priority))} />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{issue.title}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {issue.identifier ?? issue.id.slice(0, 8)} · {timeAgo(issue.updatedAt)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <StatusBadge status={issue.status} />
                                        {agentAvatar(issue.assigneeAgentId)}
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
