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

export function MenuIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
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

export function SparklesIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className} strokeWidth={1.8}>
      <path d="M12 3.5 13.8 9a2 2 0 0 0 1.2 1.2l5.5 1.8-5.5 1.8a2 2 0 0 0-1.2 1.2L12 20.5 10.2 15a2 2 0 0 0-1.2-1.2L3.5 12 9 10.2A2 2 0 0 0 10.2 9z" />
      <path d="M19 3v3" />
      <path d="M20.5 4.5h-3" />
    </Icon>
  );
}

export function RefreshIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
      <path d="M21 3v5h-5" />
    </Icon>
  );
}

export function UploadIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 16V4" />
      <path d="m6 10 6-6 6 6" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </Icon>
  );
}

export function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className} strokeWidth={2.5}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function CopyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  );
}

export function AlertTriangleIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <Icon className={className}>
      <path d="m10.29 3.86-8.18 14.14A1.5 1.5 0 0 0 3.4 20.4h17.2a1.5 1.5 0 0 0 1.3-2.4L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function FlaskIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M9 2v6.34a2 2 0 0 1-.24.96L3.6 18.3A2 2 0 0 0 5.36 21h13.28a2 2 0 0 0 1.76-2.7L15.24 9.3a2 2 0 0 1-.24-.96V2" />
      <path d="M7 2h10" />
      <path d="M8 16h8" />
    </Icon>
  );
}

export function ShieldIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 2 4 5v6c0 5 3.4 8.4 8 11 4.6-2.6 8-6 8-11V5z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function ZapIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M13 2 4.1 12.7a.5.5 0 0 0 .4.8H11l-1 8.5 8.9-10.7a.5.5 0 0 0-.4-.8H13z" />
    </Icon>
  );
}

export function HelpCircleIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function PrinterIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </Icon>
  );
}

export function HomeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={`shrink-0 ${className}`}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </Icon>
  );
}

export function GaugeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <Icon className={`shrink-0 ${className}`}>
      <path d="m12 14 3.5-3.5" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </Icon>
  );
}
