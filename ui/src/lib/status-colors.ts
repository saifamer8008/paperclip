/**
 * Canonical status & priority color definitions.
 *
 * Every component that renders a status indicator (StatusIcon, StatusBadge,
 * agent status dots, etc.) should import from here so colors stay consistent.
 */

// ---------------------------------------------------------------------------
// Issue status colors
// ---------------------------------------------------------------------------

/** StatusIcon circle: text + border classes */
export const issueStatusIcon: Record<string, string> = {
  backlog: "text-muted-foreground border-muted-foreground",
  todo: "text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400",
  in_progress: "text-yellow-600 border-yellow-600 dark:text-yellow-400 dark:border-yellow-400",
  in_review: "text-violet-600 border-violet-600 dark:text-violet-400 dark:border-violet-400",
  done: "text-green-600 border-green-600 dark:text-green-400 dark:border-green-400",
  cancelled: "text-neutral-500 border-neutral-500",
  blocked: "text-red-600 border-red-600 dark:text-red-400 dark:border-red-400",
};

export const issueStatusIconDefault = "text-muted-foreground border-muted-foreground";

/** Text-only color for issue statuses (dropdowns, labels) */
export const issueStatusText: Record<string, string> = {
  backlog: "text-muted-foreground",
  todo: "text-blue-600 dark:text-blue-400",
  in_progress: "text-yellow-600 dark:text-yellow-400",
  in_review: "text-violet-600 dark:text-violet-400",
  done: "text-green-600 dark:text-green-400",
  cancelled: "text-neutral-500",
  blocked: "text-red-600 dark:text-red-400",
};

export const issueStatusTextDefault = "text-muted-foreground";

// ---------------------------------------------------------------------------
// Badge colors — used by StatusBadge for all entity types
// ---------------------------------------------------------------------------

export const statusBadge: Record<string, string> = {
  // Agent statuses
  active: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  running: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  paused: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  idle: "bg-secondary text-muted-foreground border border-border",
  archived: "bg-secondary text-muted-foreground border border-border",

  // Goal statuses
  planned: "bg-secondary text-muted-foreground border border-border",
  achieved: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  completed: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",

  // Run statuses
  failed: "bg-red-500/10 text-red-400 border border-red-500/20",
  timed_out: "bg-red-500/10 text-red-400 border border-red-500/20",
  succeeded: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  error: "bg-red-500/10 text-red-400 border border-red-500/20",
  terminated: "bg-red-500/10 text-red-400 border border-red-500/20",
  pending: "bg-secondary text-muted-foreground border border-border",

  // Approval statuses
  pending_approval: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  revision_requested: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border border-red-500/20",

  // Issue statuses
  backlog: "bg-secondary text-muted-foreground border border-border",
  todo: "bg-secondary text-muted-foreground border border-border",
  in_progress: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  in_review: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  blocked: "bg-red-500/10 text-red-400 border border-red-500/20",
  done: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  cancelled: "bg-secondary text-muted-foreground border border-border",
};

export const statusBadgeDefault = "bg-secondary text-muted-foreground border border-border";

// ---------------------------------------------------------------------------
// Agent status dot — solid background for small indicator dots
// ---------------------------------------------------------------------------

export const agentStatusDot: Record<string, string> = {
  running: "bg-cyan-400 animate-pulse",
  active: "bg-green-400",
  paused: "bg-yellow-400",
  idle: "bg-yellow-400",
  pending_approval: "bg-amber-400",
  error: "bg-red-400",
  archived: "bg-neutral-400",
};

export const agentStatusDotDefault = "bg-neutral-400";

// ---------------------------------------------------------------------------
// Priority colors
// ---------------------------------------------------------------------------

export const priorityColor: Record<string, string> = {
  critical: "text-red-600 dark:text-red-400",
  high: "text-orange-600 dark:text-orange-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-blue-600 dark:text-blue-400",
};

export const priorityColorDefault = "text-yellow-600 dark:text-yellow-400";
