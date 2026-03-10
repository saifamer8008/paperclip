
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HudPageShell } from '@/components/HudPageShell';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Clock, Play, Loader2, AlertCircle } from 'lucide-react';
import { timeAgo } from '@/lib/timeAgo';
import { cn } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';

const GOLD = '#C9A84C';

const STATUS_COLORS = {
  ok: 'emerald',
  error: 'red',
  disabled: 'slate',
};

type CronJob = {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  schedule: {
    kind: 'cron';
    expr: string;
    tz: string;
    humanReadable: string;
  };
  state: {
    lastRunAtMs?: number;
    lastStatus: 'ok' | 'error';
    consecutiveErrors: number;
    nextRunAtMs?: number;
  };
};

type CronData = {
  version: number;
  jobs: CronJob[];
};

const fetchCrons = async (): Promise<CronData> => {
  const res = await fetch('/api/crons');
  if (!res.ok) {
    throw new Error('Failed to fetch cron jobs');
  }
  return res.json();
};

const runCron = async (id: string) => {
  const res = await fetch(`/api/crons/${id}/run`, { method: 'POST' });
  if (!res.ok) {
    throw new Error('Failed to run cron job');
  }
  return res.json();
};

const toggleCron = async ({ id, enabled }: { id: string; enabled: boolean }) => {
  const action = enabled ? 'enable' : 'disable';
  const res = await fetch(`/api/crons/${id}/${action}`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Failed to ${action} cron job`);
  }
  return res.json();
};

export function CronManager() {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const { data, isLoading, error } = useQuery<CronData>({
    queryKey: ['crons'],
    queryFn: fetchCrons,
    refetchInterval: 5000,
  });

  const runMutation = useMutation({
    mutationFn: runCron,
    onSuccess: (data, id) => {
      pushToast({ title: 'Cron Run Triggered', body: `Successfully triggered run for job ${id}.`, tone: 'success' });
      queryClient.invalidateQueries({ queryKey: ['crons'] });
    },
    onError: (err, id) => {
      pushToast({ title: 'Error', body: `Failed to trigger run for job ${id}: ${err.message}`, tone: 'error' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleCron,
    onSuccess: (data, { id, enabled }) => {
      pushToast({ title: 'Cron Status Updated', body: `Job ${id} has been ${enabled ? 'enabled' : 'disabled'}.`, tone: 'success' });
      queryClient.invalidateQueries({ queryKey: ['crons'] });
    },
    onError: (err, { id, enabled }) => {
      pushToast({ title: 'Error', body: `Failed to ${enabled ? 'enable' : 'disable'} job ${id}: ${err.message}`, tone: 'error' });
    },
  });

  const sortedJobs = data?.jobs?.sort((a, b) => {
    if (a.state.lastStatus === 'error' && b.state.lastStatus !== 'error') return -1;
    if (b.state.lastStatus === 'error' && a.state.lastStatus !== 'error') return 1;
    if (a.enabled && !b.enabled) return -1;
    if (!a.enabled && b.enabled) return 1;
    return a.name.localeCompare(b.name);
  }) || [];

  return (
    <HudPageShell icon={Clock} title="Cron Jobs" subtitle="Manage and monitor scheduled tasks">
      {isLoading && <Loader2 className="h-8 w-8 animate-spin text-white/50" />}
      {error && <div className="text-red-400">Error: {error.message}</div>}
      
      <div className="space-y-3">
        {sortedJobs.map((job) => {
          const status = job.enabled ? job.state.lastStatus : 'disabled';
          const colorName = STATUS_COLORS[status];
          const borderColor =
            status === 'error' ? 'rgba(248, 113, 113, 0.4)' :
            status === 'disabled' ? 'rgba(100, 116, 139, 0.4)' :
            'rgba(52, 211, 153, 0.4)';

          return (
            <GlassCard key={job.id} className={cn('p-4 flex items-center gap-4', { 'border-red-500/50 ring-2 ring-red-500/20': status === 'error' })} style={{ borderColor }}>
              <div className={`w-2.5 h-2.5 rounded-full bg-${colorName}-500 flex-shrink-0`} />
              
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-white text-sm font-mono">{job.name}</h3>
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/70 font-mono">{job.agentId}</span>
                </div>
                <p className="text-xs text-white/60 font-mono mt-1">{job.schedule.humanReadable} ({job.schedule.tz})</p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-white/70">
                <div className="text-right">
                    <div>Next Run</div>
                    <div>{job.state.nextRunAtMs ? timeAgo(new Date(job.state.nextRunAtMs)) : 'N/A'}</div>
                </div>
                <div className="text-right">
                    <div>Last Run</div>
                    <div>{job.state.lastRunAtMs ? timeAgo(new Date(job.state.lastRunAtMs)) : 'never'}</div>
                </div>
                <div className={cn('px-2 py-1 rounded text-center', `bg-${colorName}-500/20 text-${colorName}-400`)}>
                  {job.state.lastStatus}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={job.enabled}
                  onCheckedChange={(enabled) => toggleMutation.mutate({ id: job.id, enabled })}
                  disabled={toggleMutation.isPending && toggleMutation.variables?.id === job.id}
                />
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => runMutation.mutate(job.id)}
                  disabled={runMutation.isPending && runMutation.variables === job.id}
                >
                  {runMutation.isPending && runMutation.variables === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  <span className="ml-2">Run Now</span>
                </Button>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </HudPageShell>
  );
}
