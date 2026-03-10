import { useEffect, useState, useRef } from "react";
import { useNavigate } from "@/lib/router";
import { useCompany } from "@/context/CompanyContext";
import { cn } from "@/lib/utils";

// ── LFG brand palette
const LFG_GOLD   = "#C9A84C";
const LFG_GOLD2  = "#E8C97A";
const LFG_INDIGO = "#4F46E5";
const LFG_DIM    = "#6B7280";

// ── Ticker lines cycling at the bottom
const TICKER_LINES = [
  "SYSTEM STATUS: NOMINAL  |  ENCRYPTION: ACTIVE  |  MONITORING: 24/7",
  "AGENTS ONLINE: 14  |  TASKS IN QUEUE: 0  |  LATENCY: 12ms",
  "AUTONOMOUS MODE: ENGAGED  |  SECURITY: VERIFIED  |  UPTIME: 99.97%",
  "LFG FLEET STATUS: ALL NODES ACTIVE  |  LAST SYNC: <1s AGO",
  "BACKUP: COMPLETED  |  COMPLIANCE: VERIFIED  |  AUTONOMY: LEVEL 3",
  "ISSUES OPEN: 0  |  APPROVALS PENDING: 0  |  BUDGET: ON TRACK",
];

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Animated scan-line text (types chars in)
function TypeIn({ text, delay = 0, className }: { text: string; delay?: number; className?: string }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const t = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(t);
    }, 28);
    return () => clearInterval(t);
  }, [started, text]);

  return (
    <span className={className}>
      {displayed}
      {displayed.length < text.length && started && (
        <span className="animate-pulse opacity-80">▋</span>
      )}
    </span>
  );
}

// ── Scrolling ticker
function Ticker() {
  const [lineIndex, setLineIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let x = 0;
    const step = () => {
      x -= 0.6;
      const w = containerRef.current?.scrollWidth ?? 800;
      if (x < -w / 2) {
        x = 0;
        setLineIndex((i) => (i + 1) % TICKER_LINES.length);
      }
      setOffset(x);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const line = TICKER_LINES[lineIndex];

  return (
    <div className="overflow-hidden w-full" style={{ fontFamily: "'Space Mono', 'Courier New', monospace" }}>
      <div
        ref={containerRef}
        className="whitespace-nowrap text-[11px]"
        style={{ transform: `translateX(${offset}px)`, color: LFG_DIM }}
      >
        {line}&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;{line}&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;{line}
      </div>
    </div>
  );
}

// ── Hex grid background (pure CSS, no canvas)
function HexGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.04]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpolygon points='28,2 54,16 54,44 28,58 2,44 2,16' fill='none' stroke='%23C9A84C' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: "56px 100px",
      }}
    />
  );
}

// ── Corner brackets
function CornerBrackets() {
  const s = "border-[#C9A84C]/30";
  return (
    <>
      <div className={cn("absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2", s)} />
      <div className={cn("absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2", s)} />
      <div className={cn("absolute bottom-16 left-4 w-12 h-12 border-b-2 border-l-2", s)} />
      <div className={cn("absolute bottom-16 right-4 w-12 h-12 border-b-2 border-r-2", s)} />
    </>
  );
}

// ── Radial scan pulse
function ScanPulse() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="rounded-full animate-ping"
        style={{
          width: 320,
          height: 320,
          background: `radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)`,
          animationDuration: "3s",
        }}
      />
    </div>
  );
}

// ── Main splash
export function SplashScreen() {
  const navigate = useNavigate();
  const { companies, setSelectedCompanyId } = useCompany();
  const now = useLiveClock();
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);

  // fade-in on mount
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  function handleEnter() {
    if (entered) return;
    setEntered(true);
    // pick first company
    if (companies && companies.length > 0) {
      setSelectedCompanyId(companies[0].id);
    }
    setTimeout(() => navigate("/dashboard"), 600);
  }

  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col overflow-hidden transition-opacity duration-500",
        ready ? "opacity-100" : "opacity-0",
        entered && "opacity-0"
      )}
      style={{
        background: "radial-gradient(ellipse at 50% 30%, oklch(0.11 0.015 260) 0%, oklch(0.06 0.005 260) 100%)",
        fontFamily: "'Space Mono', 'Courier New', monospace",
      }}
    >
      <HexGrid />
      <ScanPulse />
      <CornerBrackets />

      {/* ── top strip */}
      <div className="relative z-10 flex items-center gap-3 px-6 pt-6 pb-2">
        {/* LFG hex logo */}
        <svg viewBox="0 0 32 32" className="w-8 h-8 shrink-0">
          <polygon
            points="16,2 30,9 30,23 16,30 2,23 2,9"
            fill="none"
            stroke={LFG_GOLD}
            strokeWidth="1.5"
          />
          <text x="16" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill={LFG_GOLD} fontFamily="monospace">
            LFG
          </text>
        </svg>
        <span className="text-sm tracking-[0.25em] uppercase" style={{ color: LFG_GOLD }}>
          Laissez-Faire Group
        </span>
      </div>

      {/* ── title */}
      <div className="relative z-10 px-6 pt-4">
        <h1
          className="text-5xl font-black tracking-[0.12em] uppercase leading-none"
          style={{
            color: "white",
            textShadow: `0 0 40px rgba(201,168,76,0.3), 0 0 80px rgba(79,70,229,0.15)`,
          }}
        >
          MISSION
          <br />
          CONTROL
        </h1>
      </div>

      {/* ── live clock */}
      <div className="relative z-10 px-6 pt-6">
        <div className="text-3xl font-bold tabular-nums" style={{ color: LFG_GOLD2 }}>
          {hh}:{mm}:{ss}
        </div>
        <div className="text-sm mt-1" style={{ color: LFG_DIM }}>
          {formatDate(now)}
        </div>
        {/* system online badge */}
        <div
          className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 text-xs font-bold tracking-[0.15em] uppercase"
          style={{
            background: "rgba(52,211,153,0.08)",
            border: "1px solid rgba(52,211,153,0.3)",
            color: "#34d399",
          }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <TypeIn text="SYSTEM ONLINE" delay={400} />
        </div>
      </div>

      {/* ── centre CTA */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-6">
        {/* radial glow behind ENTER */}
        <div
          className="absolute w-80 h-80 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)`,
            filter: "blur(30px)",
          }}
        />

        <div className="text-center relative">
          <h2
            className="text-7xl font-black tracking-[0.18em] uppercase"
            style={{
              color: "white",
              textShadow: `0 0 30px rgba(201,168,76,0.5), 0 0 60px rgba(201,168,76,0.2)`,
            }}
          >
            ENTER
          </h2>
          <p className="text-xs tracking-[0.4em] uppercase mt-2" style={{ color: LFG_DIM }}>
            Mission Control
          </p>
        </div>

        {/* START button */}
        <button
          onClick={handleEnter}
          disabled={entered}
          className="relative group mt-4 px-16 py-5 text-sm font-bold tracking-[0.3em] uppercase transition-all duration-200 disabled:opacity-50"
          style={{
            background: "transparent",
            border: `2px solid ${LFG_GOLD}`,
            color: LFG_GOLD2,
            boxShadow: entered ? "none" : `0 0 20px rgba(201,168,76,0.25), inset 0 0 20px rgba(201,168,76,0.05)`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 40px rgba(201,168,76,0.5), inset 0 0 30px rgba(201,168,76,0.12)`;
            (e.currentTarget as HTMLButtonElement).style.background = `rgba(201,168,76,0.08)`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 20px rgba(201,168,76,0.25), inset 0 0 20px rgba(201,168,76,0.05)`;
            (e.currentTarget as HTMLButtonElement).style.background = `transparent`;
          }}
        >
          {entered ? "LOADING…" : "START"}
        </button>
      </div>

      {/* ── bottom ticker */}
      <div
        className="relative z-10 border-t px-0 py-3"
        style={{ borderColor: "rgba(201,168,76,0.15)" }}
      >
        <Ticker />
        <p className="text-center text-[10px] mt-1 tracking-[0.2em]" style={{ color: LFG_DIM }}>
          v2.0.1-ALPHA
        </p>
      </div>
    </div>
  );
}
