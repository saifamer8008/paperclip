# LFG Mission Control — UI

A dark-themed operations dashboard for the LFG agent fleet, built on Paperclip OSS.

## Stack
- React 19 + Vite 6
- Tailwind CSS 4
- TanStack Query v5
- Framer Motion
- dnd-kit (Kanban drag and drop)
- Radix UI primitives

## Getting Started
npm install
npm run dev

## Environment
VITE_API_URL=http://localhost:3100

## Key Components
- `GlassCard` — base card with optional glow effect for running agents
- `StatusBadge` — color-coded badge for agent/issue/run statuses
- `DashboardMetric` — animated metric card for the dashboard
- `LatestRunLog` — live heartbeat activity feed

## Architecture
- `pages/` — route-level page components
- `components/` — shared UI components
- `api/` — TanStack Query API clients (do not modify)
- `hooks/` — custom React hooks
- `context/` — React context providers