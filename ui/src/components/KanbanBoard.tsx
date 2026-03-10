import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragOverEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GlassCard } from "./ui/glass-card";
import { cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import type { Issue } from "@paperclipai/shared";

const boardStatuses = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"];

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

interface Agent {
  id: string;
  name: string;
}

interface KanbanBoardProps {
  issues: Issue[];
  agents?: Agent[];
  liveIssueIds?: Set<string>;
  onUpdateIssue?: (id: string, data: Record<string, unknown>) => void;
  isBulkSelect?: boolean;
  selectedIssues?: Set<string>;
  onToggleIssueSelection?: (id: string) => void;
}

const priorityDotColor = (priority: string) => {
    switch (priority) {
        case 'urgent': return 'bg-red-500';
        case 'high': return 'bg-orange-500';
        default: return 'bg-gray-500';
    }
};

function KanbanColumn({
  status,
  issues,
  isBulkSelect,
  selectedIssues,
  onToggleIssueSelection
}: {
  status: string;
  issues: Issue[];
  isBulkSelect?: boolean;
  selectedIssues?: Set<string>;
  onToggleIssueSelection?: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] shrink-0">
      <div className="flex items-center gap-2 px-2 py-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {statusLabel(status)}
        </span>
        <span className="bg-secondary rounded-full px-2 py-0.5 text-xs ml-auto">
          {issues.length}
        </span>
      </div>
      <div ref={setNodeRef} className="bg-card/50 rounded-2xl p-3 min-h-[200px] space-y-2">
        <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map(issue => (
            <KanbanCard
              key={issue.id}
              issue={issue}
              isBulkSelect={isBulkSelect}
              isSelected={selectedIssues?.has(issue.id)}
              onToggleSelection={onToggleIssueSelection}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function KanbanCard({
  issue,
  isOverlay,
  isBulkSelect,
  isSelected,
  onToggleSelection,
}: {
  issue: Issue;
  isOverlay?: boolean;
  isBulkSelect?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { issue },
    disabled: isBulkSelect,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const cardContent = (
    <GlassCard
      className={cn(
        "p-3 cursor-grab active:cursor-grabbing",
        isDragging && !isOverlay && "opacity-30",
        isOverlay && "shadow-lg",
        isBulkSelect && "cursor-pointer",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={(e) => {
        if (isBulkSelect) {
          e.preventDefault();
          onToggleSelection?.(issue.id);
        }
      }}
    >
      <div className="flex items-start gap-2">
        {isBulkSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            readOnly
            className="mt-1"
          />
        )}
        <div className="flex-1">
          <p className="font-medium text-sm mb-2">{issue.title}</p>
          <div className="flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", priorityDotColor(issue.priority))} />
            <span className="text-xs text-muted-foreground">{timeAgo(issue.updatedAt)}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {isBulkSelect ? (
        <div className="text-inherit no-underline">{cardContent}</div>
      ) : (
        <Link to={`/issues/${issue.identifier ?? issue.id}`} className="block no-underline text-inherit">
          {cardContent}
        </Link>
      )}
    </div>
  );
}

export function KanbanBoard({
  issues,
  onUpdateIssue,
  isBulkSelect,
  selectedIssues,
  onToggleIssueSelection
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const columnIssues = useMemo(() => {
    const grouped: Record<string, Issue[]> = {};
    for (const status of boardStatuses) {
      grouped[status] = [];
    }
    for (const issue of issues) {
      if (grouped[issue.status]) {
        grouped[issue.status].push(issue);
      }
    }
    return grouped;
  }, [issues]);

  const activeIssue = useMemo(() => (activeId ? issues.find(i => i.id === activeId) : null), [activeId, issues]);

  function handleDragStart(event: DragStartEvent) {
    if (isBulkSelect) return;
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (isBulkSelect) return;
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const issueId = active.id as string;
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;

    let targetStatus: string | null = null;
    if (boardStatuses.includes(over.id as string)) {
      targetStatus = over.id as string;
    } else {
      const targetIssue = issues.find(i => i.id === over.id);
      if (targetIssue) {
        targetStatus = targetIssue.status;
      }
    }

    if (targetStatus && targetStatus !== issue.status) {
      onUpdateIssue?.(issueId, { status: targetStatus });
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
        {boardStatuses.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            issues={columnIssues[status] ?? []}
            isBulkSelect={isBulkSelect}
            selectedIssues={selectedIssues}
            onToggleIssueSelection={onToggleIssueSelection}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? <KanbanCard issue={activeIssue} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
