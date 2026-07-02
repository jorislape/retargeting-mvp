import { ReactNode } from "react";
import {
  card,
  cardHover,
  chipAmber,
  chipEmerald,
  chipNeutral,
  skeletonPanel,
  skeletonTile,
} from "./theme";

/* ------------------------------------------------------------------ */
/* Presentational primitives shared across the app shell.              */
/* No "use client" — reports/alerts must stay server components.       */
/* ------------------------------------------------------------------ */

export function Card({
  className = "",
  hover = false,
  children,
}: {
  className?: string;
  hover?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`${card}${hover ? ` ${cardHover}` : ""} ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`${card} p-10 text-center`}>
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* Status vocabulary from the landing: emerald = active/connected,
   amber = paused, neutral zinc for everything else. */
export function StatusChip({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className={chipEmerald}>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Active
      </span>
    );
  }
  if (status === "paused") {
    return <span className={chipAmber}>Paused</span>;
  }
  return (
    <span className={chipNeutral}>
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      {status}
    </span>
  );
}

export function Skeleton({
  variant = "tile",
  className = "",
}: {
  variant?: "tile" | "panel";
  className?: string;
}) {
  const base = variant === "tile" ? skeletonTile : skeletonPanel;
  return <div className={`${base} ${className}`} />;
}
