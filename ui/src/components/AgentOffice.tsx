import React from "react";
import { useCompany } from "@/context/CompanyContext";
import { GlassCard } from "./ui/glass-card";
import { WifiOff, Users } from "lucide-react";
import type { Agent } from "@paperclipai/shared";
import { motion } from "framer-motion";
import { AgentPortraitCard } from "./AgentPortraitCard";

// ── Status sort order
const STATUS_ORDER = ["running", "idle", "error", "paused", "pending_approval", "terminated"];

// ── Legend
const LEGEND = [
  { color: "bg-emerald-400", label: "Working" },
  { color: "bg-indigo-400",  label: "Standby" },
  { color: "bg-yellow-400",  label: "Paused"  },
  { color: "bg-red-500",     label: "Error"   },
];

export const AgentOffice = React.memo(({ agents }: { agents: Agent[] | undefined }) => {
  const { selectedCompanyId } = useCompany();

  if (!selectedCompanyId) return null;

  const sorted = [...(agents ?? [])].sort(
    (a, b) =>
      (STATUS_ORDER.indexOf(a.status) ?? 99) - (STATUS_ORDER.indexOf(b.status) ?? 99)
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Users className="h-3 w-3" /> Agent Roster
        </h3>
        <div className="flex items-center gap-3">
          {LEGEND.map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <GlassCard className="p-3">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <WifiOff className="h-4 w-4 mr-2" /> No agents yet
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3"
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            initial="hidden"
            animate="visible"
          >
            {sorted.map((agent) => (
              <AgentPortraitCard
                key={agent.id}
                agent={agent}
                companyId={selectedCompanyId}
              />
            ))}
          </motion.div>
        )}
      </GlassCard>
    </div>
  );
});
