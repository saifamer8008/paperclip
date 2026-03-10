/**
 * HudPageShell — shared LFG Mission Control page wrapper.
 * Provides consistent header (gold accent line, icon, title, subtitle, action slot, tab slot)
 * and a standard page body container.
 */
import type { ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";

const GOLD = "#C9A84C";

interface HudPageShellProps {
  /** Lucide icon component */
  icon?: ElementType;
  title: string;
  subtitle?: string;
  /** Slot for primary action button(s) – top-right */
  action?: ReactNode;
  /** Slot for tab bar – rendered below the title row */
  tabs?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function HudPageShell({
  icon: Icon,
  title,
  subtitle,
  action,
  tabs,
  children,
  className,
}: HudPageShellProps) {
  return (
    <div className={cn("flex flex-col gap-4 pb-6", className)} style={{ fontFamily: "'Space Mono','Courier New',monospace" }}>
      {/* ── Header */}
      <div
        className="rounded-xl px-4 py-3"
        style={{
          background: "rgba(0,0,0,0.45)",
          border: `1px solid ${GOLD}28`,
          borderLeft: `3px solid ${GOLD}`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* left: icon + title */}
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}33` }}
              >
                <Icon className="h-4 w-4" style={{ color: GOLD }} />
              </div>
            )}
            <div className="min-w-0">
              <h1
                className="text-sm font-black tracking-[0.15em] uppercase leading-tight truncate"
                style={{ color: GOLD }}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="text-[10px] tracking-widest uppercase text-white/40 mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* right: action slot */}
          {action && <div className="shrink-0">{action}</div>}
        </div>

        {/* tab bar slot */}
        {tabs && <div className="mt-3 -mb-0.5">{tabs}</div>}
      </div>

      {/* ── Body */}
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

/** Styled HUD button — replaces plain outline Button in page headers */
export function HudButton({
  onClick,
  children,
  className,
  disabled,
}: {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all duration-150 disabled:opacity-50",
        className
      )}
      style={{
        background: `${GOLD}14`,
        border: `1px solid ${GOLD}44`,
        color: GOLD,
        fontFamily: "'Space Mono','Courier New',monospace",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = `${GOLD}28`;
        el.style.boxShadow = `0 0 12px ${GOLD}33`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = `${GOLD}14`;
        el.style.boxShadow = "none";
      }}
    >
      {children}
    </button>
  );
}

/** Styled HUD tab pill row */
export function HudTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-150"
            style={{
              background: active ? `${GOLD}22` : "transparent",
              border: `1px solid ${active ? GOLD + "55" : "transparent"}`,
              color: active ? GOLD : "rgba(255,255,255,0.4)",
              fontFamily: "'Space Mono','Courier New',monospace",
            }}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className="px-1 rounded text-[9px]"
                style={{
                  background: active ? `${GOLD}33` : "rgba(255,255,255,0.08)",
                  color: active ? GOLD : "rgba(255,255,255,0.35)",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
