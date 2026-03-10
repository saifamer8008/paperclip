
import React, { useState } from 'react';
import { Wrench, Zap, Bot, FileText, Wifi, LucideIcon } from 'lucide-react';
import { HudPageShell } from '@/components/HudPageShell';
import { useQuery } from '@tanstack/react-query';

// ─────────────────────────────────────────────
//  LFG palette
// ─────────────────────────────────────────────
const GOLD = "#C9A84C";
const GOLD2 = "#E8C97A";
const CYAN = "#22D3EE";

interface GeneratedSkill {
    skillName: string;
    files: Array<{
        path: string;
        content: string;
    }>;
    instructions: string;
}

async function fetchHealth() {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Network response was not ok');
    return res.json();
}

async function fetchJournalEntries() {
    const res = await fetch('/api/journal/entries');
    // Note: This endpoint might not exist yet. Handle 404s gracefully.
    if (res.status === 404) return { count: '...' }; // Loading state
    if (!res.ok) throw new Error('Network response was not ok');
    return res.json();
}


export function ToolForge() {
  const [description, setDescription] = useState('');
  const [generatedSkill, setGeneratedSkill] = useState<GeneratedSkill | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('connection');

  const { data: healthStatus, isLoading: isHealthLoading } = useQuery({ queryKey: ['health'], queryFn: fetchHealth });
  const { data: journalData, isLoading: isJournalLoading } = useQuery({ queryKey: ['journalEntries'], queryFn: fetchJournalEntries });

  const handleForgeTool = async () => {
    if (!description) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/tool-forge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await response.json();
      setGeneratedSkill(data);
    } catch (error) {
      console.error("Tool Forge Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallTool = async () => {
    if (!generatedSkill) return;
    try {
        await fetch('/api/tool-forge/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(generatedSkill),
        });
        // You might want to add some success feedback here
    } catch (error) {
        console.error("Tool Install Error:", error);
    }
  };


  return (
    <HudPageShell icon={Wrench} title="Tool Forge" subtitle="Build and install skills">
      {/* legacy inner wrapper kept for layout compatibility */}
      <div className="text-white/90" style={{ fontFamily: "'Space Mono', 'Courier New', monospace" }}>
      <h1 className="flex items-center gap-3 text-lg font-black tracking-widest uppercase mb-6" style={{ color: GOLD }}>
        <Wrench className="w-5 h-5" />
        Tool Forge & Settings
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Section 2: Tool Forge */}
          <div className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${GOLD}22` }}>
            <h2 className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase mb-3" style={{ color: GOLD }}>
              <Zap className="w-3.5 h-3.5" />
              Tool Forge
            </h2>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe a tool: e.g. 'Check X (Twitter) mentions and summarize them daily'"
              className="w-full h-24 p-2 text-sm bg-black/30 rounded-lg border focus:outline-none focus:border-cyan-500 transition-colors"
              style={{ borderColor: `${GOLD}33` }}
            />
            <button
              onClick={handleForgeTool}
              disabled={isLoading}
              className="w-full mt-3 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all"
              style={{ background: `${GOLD}11`, color: GOLD, border: `1px solid ${GOLD}33` }}
            >
              {isLoading ? 'Forging...' : 'Forge Tool'}
            </button>

            {generatedSkill && (
              <div className="mt-4">
                <h3 className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: GOLD + 'aa' }}>Generated Skill: {generatedSkill.skillName}</h3>
                <pre className="text-xs p-3 bg-black/40 rounded-lg max-h-60 overflow-auto scrollbar-hide" style={{ borderColor: `${GOLD}22`, borderWidth: 1 }}>
                  <code>{generatedSkill.files[0].content}</code>
                </pre>
                 <button
                    onClick={handleInstallTool}
                    className="w-full mt-3 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all"
                    style={{ background: `rgba(34,211,238,0.1)`, color: CYAN, border: `1px solid rgba(34,211,238,0.2)` }}
                >
                    Install to OpenClaw
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Section 1: System Status */}
          <div className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${GOLD}22` }}>
             <h2 className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase mb-3" style={{ color: GOLD }}>
                <Wifi className="w-3.5 h-3.5" />
                System Status
            </h2>
            <div className="space-y-2">
                <StatCard icon={Bot} label="Total Agents" value={"..."} isLoading={isHealthLoading} />
                <StatCard icon={Zap} label="Active Crons" value={"..."} isLoading={isHealthLoading} />
                <StatCard icon={FileText} label="Memory Files" value={isJournalLoading ? '...' : journalData?.count} isLoading={isJournalLoading} />
            </div>
          </div>

          {/* Section 3: Settings */}
          <div className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${GOLD}22` }}>
            <div className="border-b mb-3" style={{ borderColor: `${GOLD}22` }}>
                <nav className="flex -mb-px">
                    <button onClick={() => setActiveTab('connection')} className={`px-3 py-1 text-xs font-bold uppercase tracking-widest ${activeTab === 'connection' ? `border-b-2 text-cyan-400` : 'text-white/40'}`} style={{ borderColor: CYAN }}>Connection</button>
                    <button onClick={() => setActiveTab('appearance')} className={`px-3 py-1 text-xs font-bold uppercase tracking-widest ${activeTab === 'appearance' ? `border-b-2 text-cyan-400` : 'text-white/40'}`} style={{ borderColor: CYAN }}>Appearance</button>
                    <button onClick={() => setActiveTab('backups')} className={`px-3 py-1 text-xs font-bold uppercase tracking-widest ${activeTab === 'backups' ? `border-b-2 text-cyan-400` : 'text-white/40'}`} style={{ borderColor: CYAN }}>Backups</button>
                </nav>
            </div>
            <div>
                {activeTab === 'connection' && (
                    <div>
                        <p className="text-xs text-white/60">OpenClaw API URL: <span className="text-cyan-400">{import.meta.env.VITE_API_URL || 'Not Set'}</span></p>
                        <p className="text-xs text-white/60">Gateway Status: <span className={healthStatus?.status === 'ok' ? 'text-green-400' : 'text-red-400'}>{isHealthLoading ? 'Loading...' : healthStatus?.status}</span></p>
                    </div>
                )}
                 {activeTab === 'appearance' && (
                    <p className="text-xs text-white/60">Appearance settings placeholder.</p>
                )}
                {activeTab === 'backups' && (
                    <p className="text-xs text-white/60">Auto-backup enabled. (Placeholder)</p>
                )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </HudPageShell>
  );
}

interface StatCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    isLoading: boolean;
}

function StatCard({ icon: Icon, label, value, isLoading }: StatCardProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: "rgba(0,0,0,0.4)"}}>
      <div className="flex items-center gap-2">
        <Icon className="w-3 h-3" style={{ color: GOLD + "aa" }} />
        <span className="text-xs font-medium text-white/70">{label}</span>
      </div>
      <span className="text-sm font-bold" style={{ color: GOLD2 }}>{isLoading ? '...' : value}</span>
    </div>
  )
}
