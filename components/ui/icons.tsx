import { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Shared stroke-icon system (lucide-style, hand-inlined — no icon     */
/* dependency). One convention everywhere: 24px grid, currentColor,    */
/* round caps. No "use client" — safe in server components.            */
/* ------------------------------------------------------------------ */

function Icon({
  className = "h-4 w-4",
  strokeWidth = 2,
  children,
}: {
  className?: string;
  strokeWidth?: number;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CheckIcon({
  className = "h-4 w-4 text-emerald-400",
}: {
  className?: string;
}) {
  return (
    <Icon className={`shrink-0 ${className}`} strokeWidth={2.5}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function ArrowIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className} strokeWidth={2.5}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Icon>
  );
}

export function ChevronDownIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <Icon className={className}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function HomeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </Icon>
  );
}

export function FileTextIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <Icon className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </Icon>
  );
}

export function BellIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Icon>
  );
}

export function SettingsIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <Icon className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function BarChartIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <Icon className={className}>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </Icon>
  );
}

export function SendIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </Icon>
  );
}
