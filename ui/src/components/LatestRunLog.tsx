import React from "react";
import { useQuery } from "@tanstack/react-query";
import type { HeartbeatRun, HeartbeatRunEvent } from "@paperclipai/shared";
import { heartbeatsApi } from "@/api/heartbeats";
import { GlassCard } from "./ui/glass-card";
import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/router";
import { Terminal } from "lucide-react";

function formatPayload(payload: any): string {
  if (!payload) return "";
  if (typeof payload.message === 'string') {
    const message = payload.message;
    // prevent huge multiline messages from breaking layout
    if (message.length > 200) {
        return message.slice(0, 200) + '...';
    }
    return message;
  }
  return JSON.stringify(payload);
}

function getEventTypeColor(type: string): string {
  if (type.startsWith('run.')) return 'text-emerald-400';
  if (type.startsWith('error.')) return 'text-destructive';
  if (type.startsWith('llm.')) return 'text-cyan-400';
  if (type.startsWith('tool.')) return 'text-amber-400';
  return "text-muted-foreground";
}

function RunEvent({ event }: { event: HeartbeatRunEvent }) {
    return (
        <div className="font-mono text-xs flex items-start">
            <span className="text-muted-foreground/80 mr-3 w-16 shrink-0">
                {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={cn("font-semibold mr-2", getEventTypeColor(event.type))}>
                {event.type}
            </span>
            <span className="flex-1 break-words whitespace-pre-wrap text-foreground/90">
                {formatPayload(event.payload)}
            </span>
        </div>
    )
}

export const LatestRunLog = React.memo(({ runs }: { runs: HeartbeatRun[] | undefined }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const latestRun = useMemo(() => {
    if (!runs || runs.length === 0) return null;
    return [...runs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [runs]);

  const { data: events, isLoading } = useQuery({
    queryKey: ["run-events", latestRun?.id],
    queryFn: () => heartbeatsApi.listRunEvents(latestRun!.id),
    enabled: !!latestRun,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      const isScrolledToBottom = scrollRef.current.scrollHeight - scrollRef.current.clientHeight <= scrollRef.current.scrollTop + 1;
      if (isScrolledToBottom) {
         scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [events]);

  return (
    <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Live Run Log
        </h3>
        <GlassCard className="h-96 flex flex-col p-0">
            {isLoading && !events && (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading run log...</div>
            )}
            {!latestRun && !isLoading && (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No runs recorded yet.</div>
            )}
            {latestRun && (
                <>
                    <div className="p-3 border-b border-border/50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-4 h-4" />
                            <span className="font-mono text-sm">{latestRun.agentId.slice(0,8)} / {latestRun.id.slice(0,8)}</span>
                        </div>
                        <Link to={`/runs/${latestRun.id}`} className="text-xs text-muted-foreground hover:text-foreground no-underline">View full log &rarr;</Link>
                    </div>
                    <div ref={scrollRef} className="flex-1 p-3 space-y-2 overflow-y-auto">
                        {events?.map((event) => (
                            <RunEvent key={event.id as any} event={event} />
                        ))}
                        {!isLoading && events?.length === 0 && (
                            <div className="text-sm text-muted-foreground p-2">Waiting for events...</div>
                        )}
                    </div>
                </>
            )}
        </GlassCard>
    </div>
  );
});
