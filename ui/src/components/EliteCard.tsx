/**
 * EliteCard + RoleGlyph — shared elite agent card component.
 * Used on Dashboard, Agents page, and anywhere agent cards are rendered.
 * No initials. Role-based SVG glyphs only.
 */

const GOLD = "#C9A84C";

// Role → SVG path glyph (single path, centered in 40x40 viewBox)
export function RoleGlyph({ role, color }: { role?: string; color: string }) {
  const glyphs: Record<string, string> = {
    ceo:        "M20 4 L28 14 H32 L20 36 L8 14 H12 Z",
    cto:        "M8 8 H32 V20 L20 36 L8 20 Z",
    cmo:        "M20 6 C10 6 4 14 4 20 C4 30 12 36 20 36 C28 36 36 30 36 20 C36 14 30 6 20 6 M14 18 L20 24 L26 18",
    cfo:        "M10 30 L10 18 L16 18 L16 30 M18 30 L18 12 L24 12 L24 30 M26 30 L26 22 L32 22 L32 30",
    engineer:   "M12 20 L8 16 L12 12 M28 20 L32 16 L28 12 M22 8 L18 32",
    designer:   "M20 8 L32 20 L20 32 L8 20 Z",
    pm:         "M8 10 H32 V30 H8 Z M8 15 H32 M14 10 V15 M26 10 V15",
    qa:         "M20 8 L34 28 H6 Z M20 18 V24 M20 27 V29",
    devops:     "M20 6 L34 14 V26 L20 34 L6 26 V14 Z",
    researcher: "M16 16 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0-16 0 M22 22 L34 34",
    general:    "M20 6 L34 20 L20 34 L6 20 Z M20 12 L28 20 L20 28 L12 20 Z",
  };
  const d = glyphs[role ?? "general"] ?? glyphs.general;
  return (
    <svg viewBox="0 0 40 40" width={40} height={40}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}88)` }} />
    </svg>
  );
}

export interface EliteCardProps {
  name: string;
  title?: string;
  role?: string;
  statusColor: string;
  statusLabel: string;
  lastSeen?: string;
  isLive: boolean;
  isHuman?: boolean;
  badge?: string;
  onView?: () => void;
  onPing?: () => void;
}

export function EliteCard({
  name, title, role, statusColor, statusLabel, lastSeen, isLive, isHuman,
  badge, onView, onPing,
}: EliteCardProps) {
  const c = statusColor;
  return (
    <div className="group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.02] cursor-pointer"
      style={{
        background: "linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.6) 100%)",
        border: `1px solid ${c}22`,
        boxShadow: isLive ? `0 0 20px ${c}1a, inset 0 1px 0 rgba(255,255,255,0.06)` : "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${c}0e 0%, transparent 65%)` }} />

      {/* Top color accent bar */}
      <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${c}55, transparent)` }} />

      {/* Glyph zone */}
      <div className="flex flex-col items-center pt-4 pb-2 px-3 gap-2"
        style={{ background: `linear-gradient(180deg, ${c}08 0%, transparent 100%)` }}>
        <div className="relative flex items-center justify-center">
          {isLive && (
            <div className="absolute inset-[-6px] rounded-full animate-ping opacity-10"
              style={{ background: c }} />
          )}
          <div className="relative rounded-full flex items-center justify-center"
            style={{
              width: 52, height: 52,
              background: `radial-gradient(circle at 30% 30%, ${c}18, rgba(0,0,0,0.5))`,
              border: `1px solid ${c}30`,
              boxShadow: `inset 0 1px 0 ${c}20`,
            }}>
            <RoleGlyph role={role} color={c} />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px]"
            style={{ background: c, borderColor: "rgba(5,5,10,1)", boxShadow: `0 0 5px ${c}` }} />
        </div>

        <div className="text-center w-full">
          <div className="text-[12px] font-black tracking-wide leading-tight text-white/90 truncate"
            style={{ fontFamily: "monospace" }}>
            {name}
          </div>
          {badge && (
            <div className="text-[8px] font-black tracking-widest mt-0.5" style={{ color: GOLD, fontFamily: "monospace" }}>
              {badge}
            </div>
          )}
          {title && (
            <div className="text-[9px] mt-0.5 leading-tight text-white/40 truncate">{title}</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-2.5 pb-2.5 pt-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full"
            style={{ color: c, background: `${c}15`, border: `1px solid ${c}28`, fontFamily: "monospace" }}>
            {statusLabel}
          </span>
          <span className="text-[8px] text-white/25 font-mono">{lastSeen ?? "—"}</span>
        </div>
        {!isHuman && (
          <div className="flex gap-1">
            <button onClick={onView}
              className="flex-1 text-[8px] font-black tracking-widest py-1.5 rounded-lg transition-colors"
              style={{ background: `${c}12`, border: `1px solid ${c}25`, color: c, fontFamily: "monospace" }}>
              VIEW
            </button>
            <button onClick={onPing}
              className="flex-1 text-[8px] font-black tracking-widest py-1.5 rounded-lg transition-colors"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>
              PING
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
