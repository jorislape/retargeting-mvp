"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LaunchMode = "existing" | "new";

type MetaAdOption = {
  id: string;
  name: string;
  status?: string | null;
};

type MetaAdAccountOption = {
  id: string;
  name?: string;
  account_id?: string;
};

type MetaCampaignOption = {
  id: string;
  name: string;
  status?: string | null;
};

type MetaPixelOption = {
  id: string;
  name: string;
};

/* ---------------------------------- */
/*  Small UI helpers (presentational) */
/* ---------------------------------- */

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoMark({ size = "h-9 w-9" }: { size?: string }) {
  return (
    <div
      className={`flex ${size} items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-blue-500/20`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 2 13.5 12.5" />
        <path d="M21 2l-4 20-5-9-9-5 18-6z" />
      </svg>
    </div>
  );
}

function CheckIcon({
  className = "h-4 w-4 text-emerald-400",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[13px] font-medium text-zinc-300"
    >
      {children}
    </label>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-200">
      {children}
    </div>
  );
}

function NeutralNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-[13px] text-zinc-300">
      {children}
    </div>
  );
}

/* Status chip used in the workspace bar */
function StatusChip({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: "ok" | "loading" | "warn";
}) {
  const styles =
    state === "ok"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
      : state === "loading"
        ? "border-white/10 bg-white/5 text-zinc-400"
        : "border-amber-400/25 bg-amber-500/10 text-amber-300";

  return (
    <span
      className={`inline-flex max-w-[220px] items-center gap-1.5 truncate rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}
      title={`${label}: ${value}`}
    >
      {state === "ok" && <CheckIcon className="h-3 w-3 text-emerald-400" />}
      {state === "loading" && <Spinner className="h-3 w-3" />}
      {state === "warn" && (
        <svg
          viewBox="0 0 24 24"
          className="h-3 w-3 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
      )}
      <span className="truncate">
        <span className="opacity-60">{label}:</span> {value}
      </span>
    </span>
  );
}

/* Meta-feed-style ad preview */
function MetaAdPreview({
  message,
  headline,
  description,
  domain,
}: {
  message: string;
  headline: string;
  description: string;
  domain: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#242526] text-[#e4e6eb] shadow-lg shadow-black/30">
      {/* Post header */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-700 text-sm font-bold text-white">
          P
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold">Your Page</div>
          <div className="flex items-center gap-1 text-[12px] text-[#b0b3b8]">
            Sponsored
            <span aria-hidden="true">·</span>
            <svg
              viewBox="0 0 16 16"
              className="h-3 w-3"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 0 1 3.9 1.6c-.3.5-.8.9-1.4.9-.5 0-.9.4-.9.9v.6c0 .5-.4.9-.9.9h-1c-.5 0-.9.4-.9.9v.5c0 .5.4.9.9.9h.4c.5 0 .9.4.9.9v1.6A5.5 5.5 0 0 1 8 2.5z" />
            </svg>
          </div>
        </div>
        <div className="ml-auto text-[#b0b3b8]">···</div>
      </div>

      {/* Primary text */}
      <p className="whitespace-pre-line px-4 py-3 text-[14px] leading-snug">
        {message || "Your ad message will appear here."}
      </p>

      {/* Media placeholder */}
      <div className="flex h-40 items-center justify-center bg-gradient-to-br from-zinc-700/60 to-zinc-800/80">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8 text-zinc-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
        </svg>
      </div>

      {/* Link card */}
      <div className="flex items-center justify-between gap-3 bg-[#3a3b3c] px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-[11px] uppercase tracking-wide text-[#b0b3b8]">
            {domain || "your-site.com"}
          </div>
          <div className="truncate text-[14px] font-semibold">
            {headline || "Your headline"}
          </div>
          {description ? (
            <div className="truncate text-[12px] text-[#b0b3b8]">
              {description}
            </div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-md bg-[#4e4f50] px-3 py-1.5 text-[13px] font-semibold">
          Shop now
        </span>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-around border-t border-white/5 px-4 py-1.5 text-[12px] font-medium text-[#b0b3b8]">
        <span>👍 Like</span>
        <span>💬 Comment</span>
        <span>↗ Share</span>
      </div>
    </div>
  );
}

const inputClasses =
  "w-full rounded-lg border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-[14px] text-white placeholder-zinc-500 outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";

const selectClasses = `${inputClasses} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%2371717a%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M4.4%206l3.6%203.6L11.6%206%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%221.6%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[right_0.85rem_center] bg-no-repeat pr-9`;

const primaryButtonClasses =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-[14px] font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:bg-blue-600";

const secondaryButtonClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

const cardClasses =
  "rounded-2xl border border-white/10 bg-zinc-900/60 p-5 shadow-xl shadow-black/20 backdrop-blur";

const LAUNCH_STAGES = [
  "Creating custom audience...",
  "Creating ad set...",
  "Creating ad...",
  "Finalizing...",
];

/* -------------- */
/*  Page          */
/* -------------- */

export default function DashboardPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [accessError, setAccessError] = useState("");

  const [mode, setMode] = useState<LaunchMode>("existing");

  const [existingAdId, setExistingAdId] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState(1);
  const [days, setDays] = useState(30);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formError, setFormError] = useState("");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);

  const [ads, setAds] = useState<MetaAdOption[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsError, setAdsError] = useState("");

  const [adAccounts, setAdAccounts] = useState<MetaAdAccountOption[]>([]);
  const [adAccountsLoading, setAdAccountsLoading] = useState(false);
  const [adAccountsError, setAdAccountsError] = useState("");
  const [selectedAdAccountId, setSelectedAdAccountId] = useState("");

  const [campaigns, setCampaigns] = useState<MetaCampaignOption[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsError, setCampaignsError] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  const [pixels, setPixels] = useState<MetaPixelOption[]>([]);
  const [pixelsLoading, setPixelsLoading] = useState(false);
  const [pixelsError, setPixelsError] = useState("");
  const [selectedPixelId, setSelectedPixelId] = useState("");

  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  /* UI-only: animated stage label while the launch request is in flight */
  const [launchStage, setLaunchStage] = useState(0);

  const hasTriedLoadingAds = useRef(false);
  const previewRequestIdRef = useRef(0);

  const normalizedSelectedAdAccountId = selectedAdAccountId.trim()
    ? normalizeAccountId(selectedAdAccountId)
    : "";

  function isValidUrl(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  const selectedCampaignName =
    campaigns.find((campaign) => campaign.id === selectedCampaignId)?.name ||
    "";
  const selectedPixelName =
    pixels.find((pixel) => pixel.id === selectedPixelId)?.name || "";
  const selectedAdName = ads.find((ad) => ad.id === existingAdId)?.name || "";

  const setupIssues = useMemo(() => {
    const issues: string[] = [];

    if (!selectedAdAccountId.trim()) {
      issues.push("Select an ad account.");
    }

    if (!selectedCampaignId.trim()) {
      if (campaignsLoading) {
        issues.push("Detecting your campaign...");
      } else if (campaignsError) {
        issues.push("We couldn't load a campaign for this account.");
      } else {
        issues.push("No campaign found in this account.");
      }
    }

    if (!selectedPixelId.trim()) {
      if (pixelsLoading) {
        issues.push("Detecting your pixel...");
      } else if (pixelsError) {
        issues.push("We couldn't load a pixel for this account.");
      } else {
        issues.push("No pixel found in this account.");
      }
    }

    return issues;
  }, [
    selectedAdAccountId,
    selectedCampaignId,
    selectedPixelId,
    campaignsLoading,
    campaignsError,
    pixelsLoading,
    pixelsError,
  ]);

  const validationError = useMemo(() => {
    if (!selectedAdAccountId.trim()) {
      return "Please select an ad account.";
    }

    if (!selectedCampaignId.trim()) {
      return "A campaign is required before launch.";
    }

    if (!selectedPixelId.trim()) {
      return "A pixel is required before launch.";
    }

    if (!Number.isFinite(budget) || budget < 1) {
      return "Daily budget must be at least €1.";
    }

    if (![7, 14, 30].includes(days)) {
      return "Audience window must be 7, 14, or 30 days.";
    }

    if (mode === "existing") {
      if (!existingAdId.trim()) {
        return "Please select an existing ad.";
      }

      if (!/^\d+$/.test(existingAdId.trim())) {
        return "Selected ad ID is invalid.";
      }

      return "";
    }

    if (!message.trim()) return "Ad message is required.";
    if (!link.trim()) return "Destination link is required.";
    if (!isValidUrl(link.trim())) return "Please enter a valid URL.";
    if (!productName.trim()) return "Product name is required.";

    return "";
  }, [
    selectedAdAccountId,
    selectedCampaignId,
    selectedPixelId,
    budget,
    days,
    mode,
    existingAdId,
    message,
    link,
    productName,
  ]);

  const isFormValid = !validationError;
  const isLaunchBlocked = loading || !isFormValid;
  const isSetupReady = setupIssues.length === 0;

  async function checkSession() {
    try {
      const res = await fetch("/api/meta/session", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();
      setConnected(Boolean(data?.connected));
    } catch {
      setConnected(false);
    }
  }

  async function loadAdAccounts() {
    try {
      setAdAccountsLoading(true);
      setAdAccountsError("");

      const res = await fetch("/api/meta/ad-accounts", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load ad accounts.");
      }

      const nextAccounts: MetaAdAccountOption[] = Array.isArray(data.adAccounts)
        ? data.adAccounts
        : [];

      setAdAccounts(nextAccounts);

      if (nextAccounts.length === 0) {
        setSelectedAdAccountId("");
        setAds([]);
        setExistingAdId("");
        throw new Error("No ad accounts found.");
      }

      setSelectedAdAccountId((current) => {
        if (
          current &&
          nextAccounts.some(
            (account) =>
              normalizeAccountId(account.id) === normalizeAccountId(current)
          )
        ) {
          return current;
        }

        return nextAccounts[0].id;
      });
    } catch (err: any) {
      setAdAccounts([]);
      setSelectedAdAccountId("");
      setAdAccountsError(err?.message || "Failed to load ad accounts.");
    } finally {
      setAdAccountsLoading(false);
    }
  }

  async function loadCampaigns(adAccountId: string) {
    try {
      setCampaignsLoading(true);
      setCampaignsError("");

      if (!adAccountId.trim()) {
        setCampaigns([]);
        setSelectedCampaignId("");
        return;
      }

      const res = await fetch("/api/meta/list-campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adAccountId,
        }),
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load campaigns.");
      }

      const nextCampaigns: MetaCampaignOption[] = Array.isArray(data.campaigns)
        ? data.campaigns
        : [];

      setCampaigns(nextCampaigns);

      setSelectedCampaignId((current) => {
        if (
          current &&
          nextCampaigns.some((campaign) => campaign.id === current)
        ) {
          return current;
        }

        return nextCampaigns[0]?.id || "";
      });
    } catch (err: any) {
      setCampaigns([]);
      setSelectedCampaignId("");
      setCampaignsError(err?.message || "Failed to load campaigns.");
    } finally {
      setCampaignsLoading(false);
    }
  }

  async function loadPixels(adAccountId: string) {
    try {
      setPixelsLoading(true);
      setPixelsError("");

      if (!adAccountId.trim()) {
        setPixels([]);
        setSelectedPixelId("");
        return;
      }

      const res = await fetch("/api/meta/list-pixels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adAccountId,
        }),
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load pixels.");
      }

      const nextPixels: MetaPixelOption[] = Array.isArray(data.pixels)
        ? data.pixels
        : [];

      setPixels(nextPixels);

      setSelectedPixelId((current) => {
        if (current && nextPixels.some((pixel) => pixel.id === current)) {
          return current;
        }

        return nextPixels[0]?.id || "";
      });
    } catch (err: any) {
      setPixels([]);
      setSelectedPixelId("");
      setPixelsError(err?.message || "Failed to load pixels.");
    } finally {
      setPixelsLoading(false);
    }
  }

  async function loadAds() {
    try {
      setAdsLoading(true);
      setAdsError("");

      if (!selectedAdAccountId.trim()) {
        throw new Error("No ad account selected.");
      }

      const res = await fetch("/api/meta/list-ads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adAccountId: selectedAdAccountId,
        }),
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load ads.");
      }

      const nextAds = Array.isArray(data.ads) ? data.ads : [];
      setAds(nextAds);

      setExistingAdId((current) => {
        if (current && nextAds.some((ad: MetaAdOption) => ad.id === current)) {
          return current;
        }

        return nextAds[0]?.id || "";
      });
    } catch (err: any) {
      setAdsError(err?.message || "Failed to load ads.");
      setAds([]);
      setExistingAdId("");
    } finally {
      setAdsLoading(false);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    checkSession();
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked || !connected) return;
    loadAdAccounts();
  }, [unlocked, connected]);

  useEffect(() => {
    hasTriedLoadingAds.current = false;
    setAds([]);
    setAdsError("");
    setExistingAdId("");
    setPreviewError("");
    setPreviewData(null);
    setPreviewLoading(false);
    setCampaigns([]);
    setSelectedCampaignId("");
    setCampaignsError("");
    setPixels([]);
    setSelectedPixelId("");
    setPixelsError("");
    previewRequestIdRef.current += 1;
  }, [selectedAdAccountId]);

  useEffect(() => {
    if (!unlocked || !connected || !selectedAdAccountId.trim()) return;
    loadCampaigns(selectedAdAccountId);
    loadPixels(selectedAdAccountId);
  }, [unlocked, connected, selectedAdAccountId]);

  useEffect(() => {
    if (!unlocked || !connected) return;
    if (mode !== "existing") return;
    if (!selectedAdAccountId.trim()) return;
    if (hasTriedLoadingAds.current) return;

    hasTriedLoadingAds.current = true;
    loadAds();
  }, [unlocked, connected, mode, selectedAdAccountId]);

  /* UI-only: cycle the launch stage label while loading */
  useEffect(() => {
    if (!loading) {
      setLaunchStage(0);
      return;
    }

    const interval = setInterval(() => {
      setLaunchStage((current) =>
        current < LAUNCH_STAGES.length - 1 ? current + 1 : current
      );
    }, 1400);

    return () => clearInterval(interval);
  }, [loading]);

  async function handlePreviewAd(adIdOverride?: string) {
    const adIdToUse = (adIdOverride ?? existingAdId).trim();

    if (!selectedAdAccountId.trim()) {
      setPreviewError("Ad account is required.");
      setPreviewData(null);
      return;
    }

    if (!adIdToUse) {
      setPreviewError("Existing ad is required.");
      setPreviewData(null);
      return;
    }

    const requestId = ++previewRequestIdRef.current;

    setPreviewLoading(true);
    setPreviewError("");

    try {
      const res = await fetch("/api/meta/preview-ad", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adId: adIdToUse,
          adAccountId: selectedAdAccountId,
        }),
      });

      const data = await res.json();

      if (requestId !== previewRequestIdRef.current) return;

      if (!res.ok || !data.ok) {
        setPreviewData(null);
        setPreviewError(
          typeof data.error === "string"
            ? data.error
            : data.error?.message || "Failed to preview ad."
        );
        return;
      }

      setPreviewData(data.data);
      setPreviewError("");
    } catch {
      if (requestId !== previewRequestIdRef.current) return;

      setPreviewData(null);
      setPreviewError("Preview request failed.");
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setPreviewLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!unlocked || !connected) return;
    if (mode !== "existing") return;
    if (!selectedAdAccountId.trim()) return;

    const trimmedAdId = existingAdId.trim();

    if (!trimmedAdId) {
      previewRequestIdRef.current += 1;
      setPreviewLoading(false);
      setPreviewError("");
      setPreviewData(null);
      return;
    }

    handlePreviewAd(trimmedAdId);
  }, [existingAdId, mode, unlocked, connected, selectedAdAccountId]);

  async function handleLaunchRetargeting() {
    if (!isFormValid) {
      setFormError(validationError);
      return;
    }

    setLoading(true);
    setResult(null);
    setFormError("");

    try {
      const payload =
        mode === "existing"
          ? {
              mode: "existing",
              adAccountId: selectedAdAccountId,
              campaignId: selectedCampaignId,
              pixelId: selectedPixelId,
              audienceName: `Visitors ${days}d`,
              retentionSeconds: days * 86400,
              dailyBudget: budget * 100,
              existingAdId: existingAdId.trim(),
            }
          : {
              mode: "new",
              adAccountId: selectedAdAccountId,
              campaignId: selectedCampaignId,
              pixelId: selectedPixelId,
              audienceName: `Visitors ${days}d`,
              retentionSeconds: days * 86400,
              dailyBudget: budget * 100,
              existingAdId: "",
              message: message.trim(),
              link: link.trim(),
              name: productName.trim(),
              description: description.trim(),
            };

      const res = await fetch("/api/meta/launch-retargeting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setResult(data);
    } catch {
      setResult({
        ok: false,
        error: "Request failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------- */
  /*  Screen: access gate      */
  /* ------------------------- */

  if (!unlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100 antialiased">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <LogoMark />
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
              Retargeting Dashboard
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              This is a private beta. Enter your access code to continue.
            </p>
          </div>

          <div className={cardClasses}>
            <FieldLabel htmlFor="accessCode">Access code</FieldLabel>
            <input
              id="accessCode"
              type="password"
              placeholder="••••••••"
              value={accessCode}
              onChange={(e) => {
                setAccessCode(e.target.value);
                setAccessError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (
                    accessCode === process.env.NEXT_PUBLIC_DASHBOARD_ACCESS_CODE
                  ) {
                    setUnlocked(true);
                  } else {
                    setAccessError(
                      "That code doesn't match. Please try again."
                    );
                  }
                }
              }}
              className={inputClasses}
              autoFocus
            />

            {accessError && <ErrorNote>{accessError}</ErrorNote>}

            <button
              onClick={() => {
                if (
                  accessCode === process.env.NEXT_PUBLIC_DASHBOARD_ACCESS_CODE
                ) {
                  setUnlocked(true);
                } else {
                  setAccessError("That code doesn't match. Please try again.");
                }
              }}
              className={`${primaryButtonClasses} mt-5`}
            >
              Unlock dashboard
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-600">
            Don't have a code? Contact us for beta access.
          </p>
        </div>
      </main>
    );
  }

  /* ------------------------- */
  /*  Screen: checking session */
  /* ------------------------- */

  if (connected === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100 antialiased">
        <div className="flex flex-col items-center gap-4">
          <LogoMark />
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Spinner />
            Checking your Meta connection...
          </div>
        </div>
      </main>
    );
  }

  /* ------------------------- */
  /*  Screen: connect Meta     */
  /* ------------------------- */

  if (!connected) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-zinc-100 antialiased">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <LogoMark />
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
              Connect your Meta account
            </h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
              We use Meta's official API to read your ad accounts and create
              retargeting campaigns on your behalf. Everything is created in{" "}
              <span className="font-medium text-zinc-200">paused</span> status —
              nothing spends until you approve it.
            </p>
          </div>

          <div className={cardClasses}>
            <ul className="space-y-3 text-sm text-zinc-300">
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span>Secure OAuth login — we never see your password</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span>Campaign and pixel are detected automatically</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span>All ads launch paused, so you stay in control</span>
              </li>
            </ul>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/meta/oauth/start";
              }}
              className={`${primaryButtonClasses} mt-6`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
              </svg>
              Continue with Meta
            </button>

            <button
              type="button"
              onClick={() => {
                checkSession();
              }}
              className={`${secondaryButtonClasses} mt-3 w-full`}
            >
              I've already connected — refresh status
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ------------------------- */
  /*  Screen: main dashboard   */
  /* ------------------------- */

  const previewMessage =
    mode === "existing" ? previewData?.message || "" : message;
  const previewHeadline =
    mode === "existing"
      ? previewData?.headline || previewData?.adName || selectedAdName || ""
      : productName;
  const previewDescription =
    mode === "existing" ? previewData?.description || "" : description;
  const previewDomain = mode === "existing" ? "" : getDomain(link);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <LogoMark size="h-8 w-8" />
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold tracking-tight text-white">
                Meta Retargeting
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Beta
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Meta connected
          </div>
        </div>
      </header>

      {/* Workspace bar: account + auto-detected setup */}
      <div className="border-b border-white/5 bg-zinc-900/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3">
          <select
            id="adAccount"
            value={selectedAdAccountId}
            onChange={(e) => {
              setSelectedAdAccountId(e.target.value);
              setFormError("");
              setResult(null);
            }}
            className={`${selectClasses} w-auto min-w-[240px] max-w-xs`}
            disabled={adAccountsLoading}
            aria-label="Ad account"
          >
            <option value="">
              {adAccountsLoading
                ? "Loading ad accounts..."
                : "Select an ad account"}
            </option>

            {adAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name || account.id} ({normalizeAccountId(account.id)})
              </option>
            ))}
          </select>

          {selectedAdAccountId ? (
            <>
              <StatusChip
                label="Campaign"
                value={
                  campaignsLoading
                    ? "Detecting..."
                    : selectedCampaignName || "Not found"
                }
                state={
                  campaignsLoading
                    ? "loading"
                    : selectedCampaignId
                      ? "ok"
                      : "warn"
                }
              />
              <StatusChip
                label="Pixel"
                value={
                  pixelsLoading
                    ? "Detecting..."
                    : selectedPixelName || "Not found"
                }
                state={
                  pixelsLoading ? "loading" : selectedPixelId ? "ok" : "warn"
                }
              />
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setShowTechnicalDetails((current) => !current)}
            className="ml-auto text-xs font-medium text-zinc-500 underline-offset-4 transition hover:text-zinc-300 hover:underline"
          >
            {showTechnicalDetails ? "Hide advanced" : "Advanced"}
          </button>
        </div>

        {adAccountsError && (
          <div className="mx-auto max-w-6xl px-6 pb-3">
            <ErrorNote>{adAccountsError}</ErrorNote>
          </div>
        )}

        {showTechnicalDetails ? (
          <div className="border-t border-white/5 bg-black/20">
            <div className="mx-auto grid max-w-6xl gap-4 px-6 py-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="campaignId">Campaign override</FieldLabel>
                <select
                  id="campaignId"
                  value={selectedCampaignId}
                  onChange={(e) => {
                    setSelectedCampaignId(e.target.value);
                    setFormError("");
                    setResult(null);
                  }}
                  className={selectClasses}
                  disabled={campaignsLoading || !selectedAdAccountId}
                >
                  <option value="">
                    {campaignsLoading
                      ? "Loading campaigns..."
                      : !selectedAdAccountId
                        ? "Select an ad account first"
                        : "Select a campaign"}
                  </option>

                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} ({campaign.id})
                      {campaign.status ? ` — ${campaign.status}` : ""}
                    </option>
                  ))}
                </select>
                {campaignsError && <ErrorNote>{campaignsError}</ErrorNote>}
              </div>

              <div>
                <FieldLabel htmlFor="pixelId">Pixel override</FieldLabel>
                <select
                  id="pixelId"
                  value={selectedPixelId}
                  onChange={(e) => {
                    setSelectedPixelId(e.target.value);
                    setFormError("");
                    setResult(null);
                  }}
                  className={selectClasses}
                  disabled={pixelsLoading || !selectedAdAccountId}
                >
                  <option value="">
                    {pixelsLoading
                      ? "Loading pixels..."
                      : !selectedAdAccountId
                        ? "Select an ad account first"
                        : "Select a pixel"}
                  </option>

                  {pixels.map((pixel) => (
                    <option key={pixel.id} value={pixel.id}>
                      {pixel.name} ({pixel.id})
                    </option>
                  ))}
                </select>
                {pixelsError && <ErrorNote>{pixelsError}</ErrorNote>}
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Your Facebook Page is selected automatically during launch.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Main two-column layout */}
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* LEFT — creative */}
          <section className={cardClasses}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-white">
                  Creative
                </h2>
                <p className="mt-0.5 text-[13px] text-zinc-400">
                  {mode === "existing"
                    ? "Reuse a proven ad — the fastest path to launch."
                    : "Write fresh copy. The preview updates as you type."}
                </p>
              </div>

              {/* Segmented control */}
              <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("existing");
                    hasTriedLoadingAds.current = false;
                    setFormError("");
                    setResult(null);
                    setPreviewError("");
                    setPreviewData(null);
                  }}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                    mode === "existing"
                      ? "bg-blue-600 text-white shadow"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Reuse existing ad
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("new");
                    setFormError("");
                    setResult(null);
                    setPreviewError("");
                    setPreviewData(null);
                    setExistingAdId("");
                  }}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                    mode === "new"
                      ? "bg-blue-600 text-white shadow"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Create new ad
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {/* Inputs column */}
              <div>
                {mode === "existing" ? (
                  <>
                    <div className="flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <FieldLabel htmlFor="existingAdId">
                          Source ad
                        </FieldLabel>
                        <select
                          id="existingAdId"
                          value={existingAdId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            setExistingAdId(selectedId);
                            setFormError("");
                            setResult(null);
                            setPreviewError("");
                          }}
                          className={selectClasses}
                          disabled={adsLoading || !selectedAdAccountId}
                        >
                          <option value="">
                            {adsLoading
                              ? "Loading ads..."
                              : !selectedAdAccountId
                                ? "Select an ad account first"
                                : "Select an ad"}
                          </option>

                          {ads.map((ad) => (
                            <option key={ad.id} value={ad.id}>
                              {ad.name} ({ad.id})
                              {ad.status ? ` — ${ad.status}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        title="Reload ad list"
                        onClick={() => {
                          hasTriedLoadingAds.current = false;
                          loadAds();
                        }}
                        disabled={adsLoading || !selectedAdAccountId}
                        className={`${secondaryButtonClasses} h-[42px] px-3`}
                      >
                        {adsLoading ? (
                          <Spinner />
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                            <path d="M21 3v6h-6" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {adsError && <ErrorNote>{adsError}</ErrorNote>}

                    {!adsLoading &&
                      !adsError &&
                      selectedAdAccountId &&
                      ads.length === 0 && (
                        <NeutralNote>
                          No ads found in this account yet. Switch to{" "}
                          <span className="font-medium text-white">
                            Create new ad
                          </span>{" "}
                          to write one from scratch.
                        </NeutralNote>
                      )}

                    {previewError && <ErrorNote>{previewError}</ErrorNote>}

                    {previewData && !previewLoading && (
                      <div className="mt-4 space-y-2 rounded-lg border border-white/5 bg-black/20 p-3.5 text-[13px]">
                        <div className="flex items-center gap-1.5 font-medium text-emerald-300">
                          <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                          Creative ready to reuse
                        </div>
                        <div className="text-zinc-400">
                          Ad name:{" "}
                          <span className="text-zinc-200">
                            {previewData.adName || selectedAdName || "—"}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid gap-4">
                    <div>
                      <FieldLabel htmlFor="message">Ad message</FieldLabel>
                      <textarea
                        id="message"
                        placeholder="Still thinking about it? Your favorites are waiting — come back and save 10% today."
                        value={message}
                        onChange={(e) => {
                          setMessage(e.target.value);
                          setFormError("");
                        }}
                        rows={4}
                        className={`${inputClasses} resize-y`}
                      />
                    </div>

                    <div>
                      <FieldLabel htmlFor="link">Destination link</FieldLabel>
                      <input
                        id="link"
                        placeholder="https://your-site.com/product"
                        value={link}
                        onChange={(e) => {
                          setLink(e.target.value);
                          setFormError("");
                        }}
                        className={inputClasses}
                      />
                    </div>

                    <div>
                      <FieldLabel htmlFor="productName">
                        Product name
                      </FieldLabel>
                      <input
                        id="productName"
                        placeholder="e.g. Aurora Skincare Set"
                        value={productName}
                        onChange={(e) => {
                          setProductName(e.target.value);
                          setFormError("");
                        }}
                        className={inputClasses}
                      />
                    </div>

                    <div>
                      <FieldLabel htmlFor="description">
                        Description{" "}
                        <span className="font-normal text-zinc-500">
                          (optional)
                        </span>
                      </FieldLabel>
                      <input
                        id="description"
                        placeholder="Short supporting line"
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          setFormError("");
                        }}
                        className={inputClasses}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Preview column */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-zinc-300">
                    Ad preview
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-zinc-600">
                    Facebook feed
                  </span>
                </div>

                {mode === "existing" && previewLoading ? (
                  <div className="flex h-64 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-sm text-zinc-400">
                    <span className="flex items-center gap-2">
                      <Spinner />
                      Loading preview...
                    </span>
                  </div>
                ) : mode === "existing" && !previewData ? (
                  <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-sm text-zinc-500">
                    Select a source ad to see how it looks in the feed.
                  </div>
                ) : (
                  <MetaAdPreview
                    message={previewMessage}
                    headline={previewHeadline}
                    description={previewDescription}
                    domain={previewDomain}
                  />
                )}
              </div>
            </div>
          </section>

          {/* RIGHT — sticky launch panel */}
          <aside className="space-y-4 lg:sticky lg:top-[72px]">
            <section className={cardClasses}>
              <h2 className="text-base font-semibold tracking-tight text-white">
                Audience &amp; budget
              </h2>

              <div className="mt-4 grid gap-4">
                <div>
                  <FieldLabel htmlFor="days">Retarget</FieldLabel>
                  <select
                    id="days"
                    value={days}
                    onChange={(e) => {
                      setDays(Number(e.target.value));
                      setFormError("");
                    }}
                    className={selectClasses}
                  >
                    <option value={7}>Visitors from the last 7 days</option>
                    <option value={14}>Visitors from the last 14 days</option>
                    <option value={30}>Visitors from the last 30 days</option>
                  </select>
                </div>

                <div>
                  <FieldLabel htmlFor="budget">Daily budget</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      €
                    </span>
                    <input
                      id="budget"
                      type="number"
                      min="1"
                      value={budget}
                      onChange={(e) => {
                        setBudget(Number(e.target.value));
                        setFormError("");
                      }}
                      className={`${inputClasses} pl-8`}
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <dl className="mt-5 space-y-2 border-t border-white/5 pt-4 text-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-zinc-500">Account</dt>
                  <dd className="truncate font-mono text-[12px] text-zinc-200">
                    {normalizedSelectedAdAccountId || "—"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-zinc-500">Creative</dt>
                  <dd className="truncate text-right text-zinc-200">
                    {mode === "existing"
                      ? selectedAdName || existingAdId || "—"
                      : productName.trim()
                        ? `New — ${productName.trim()}`
                        : "New ad"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-zinc-500">Audience</dt>
                  <dd className="text-zinc-200">Visitors, {days}d</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-zinc-500">Budget</dt>
                  <dd className="text-zinc-200">€{budget} / day</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-zinc-500">Launch status</dt>
                  <dd>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                      Paused
                    </span>
                  </dd>
                </div>
              </dl>

              {(formError || validationError) && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.07] px-3.5 py-2.5 text-[13px] text-amber-200">
                  <svg
                    viewBox="0 0 24 24"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  </svg>
                  {formError || validationError}
                </div>
              )}

              <button
                onClick={handleLaunchRetargeting}
                disabled={isLaunchBlocked}
                className={`${primaryButtonClasses} mt-4`}
              >
                {loading ? (
                  <>
                    <Spinner />
                    {LAUNCH_STAGES[launchStage]}
                  </>
                ) : (
                  "Launch retargeting campaign"
                )}
              </button>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
                Created paused via Meta's official Marketing API.
                <br />
                Nothing spends until you activate it.
              </p>
            </section>

            {/* Safety card */}
            <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Account safety
              </div>
              <ul className="mt-2.5 space-y-2 text-[13px] text-zinc-400">
                <li className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                  Existing campaigns and ads are never modified
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                  Everything launches in paused status
                </li>
                <li className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                  You activate and can delete everything in Ads Manager
                </li>
              </ul>
            </section>
          </aside>
        </div>

        <footer className="mt-12 border-t border-white/5 pt-5 text-center text-xs text-zinc-600">
          All campaigns are created via Meta's official Marketing API and start
          in paused status.
        </footer>
      </div>

      {/* Result modal */}
      {result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl shadow-black/50">
            {result.ok ? (
              <>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-8 ring-emerald-500/5">
                    <CheckIcon className="h-7 w-7 text-emerald-300" />
                  </div>
                  <h2 className="mt-4 text-xl font-bold tracking-tight text-white">
                    Campaign created
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                    Everything is in paused status — review it and activate
                    whenever you're ready.
                  </p>
                </div>

                <ul className="mt-5 space-y-2.5 rounded-xl border border-white/5 bg-black/20 p-4 text-[13px] text-zinc-300">
                  <li className="flex items-center gap-2.5">
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                    Custom audience — visitors, last {days} days
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                    Ad set — €{budget}/day (paused)
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                    {result.reusedCreativeId
                      ? "Ad — existing creative reused"
                      : "Ad — created from your new copy"}
                  </li>
                </ul>

                <a
                  href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${stripAccountId(
                    selectedAdAccountId
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${primaryButtonClasses} mt-5`}
                >
                  Review &amp; activate in Ads Manager
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 17 17 7" />
                    <path d="M7 7h10v10" />
                  </svg>
                </a>

                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-500 transition hover:text-zinc-300">
                    Technical details
                  </summary>
                  <dl className="mt-3 space-y-1.5 rounded-lg bg-black/30 p-4 font-mono text-xs leading-relaxed text-zinc-400">
                    <div>
                      Ad account: {normalizeAccountId(selectedAdAccountId)}
                    </div>
                    <div>Page ID: {result.pageId || "—"}</div>
                    <div>
                      Campaign:{" "}
                      {selectedCampaignName || selectedCampaignId || "—"}
                    </div>
                    <div>
                      Pixel: {selectedPixelName || selectedPixelId || "—"}
                    </div>
                    <div>Audience ID: {result.audienceId}</div>
                    <div>Ad set ID: {result.adsetId}</div>
                    <div>Ad ID: {result.adId}</div>
                    {result.reusedCreativeId && (
                      <div>
                        Reused creative ID: {result.reusedCreativeId}
                      </div>
                    )}
                  </dl>
                </details>

                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                  }}
                  className={`${secondaryButtonClasses} mt-4 w-full`}
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 ring-8 ring-red-500/5">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-7 w-7 text-red-300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </div>
                  <h2 className="mt-4 text-xl font-bold tracking-tight text-white">
                    Launch didn't complete
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                    Nothing was charged and no assets were activated. Adjust
                    the inputs and try again.
                  </p>
                </div>

                {result.step && (
                  <div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    Failed at step:{" "}
                    <span className="font-semibold">{result.step}</span>
                  </div>
                )}

                {typeof result.error === "string" && (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                    {result.error}
                  </p>
                )}

                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-500 transition hover:text-zinc-300">
                    Show full error details
                  </summary>
                  <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-4 font-mono text-xs leading-relaxed text-zinc-400">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>

                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setFormError("");
                  }}
                  className={`${primaryButtonClasses} mt-5`}
                >
                  Try again
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/* -------- */
/*  Utils   */
/* -------- */

function normalizeAccountId(id: string) {
  return id.startsWith("act_") ? id : `act_${id}`;
}

function stripAccountId(id: string) {
  return id.startsWith("act_") ? id.slice(4) : id;
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
