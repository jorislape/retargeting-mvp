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

function LogoMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-blue-500/20">
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

function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/10 text-sm font-bold text-blue-300">
        {step}
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{subtitle}</p>
      </div>
    </div>
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
      className="mb-2 block text-sm font-medium text-zinc-300"
    >
      {children}
    </label>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      {children}
    </div>
  );
}

function NeutralNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
      {children}
    </div>
  );
}

const inputClasses =
  "w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-[15px] text-white placeholder-zinc-500 outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";

const selectClasses = `${inputClasses} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%2371717a%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M4.4%206l3.6%203.6L11.6%206%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%221.6%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[right_1rem_center] bg-no-repeat pr-10`;

const primaryButtonClasses =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:bg-blue-600";

const secondaryButtonClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

const cardClasses =
  "rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl shadow-black/20 backdrop-blur";

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
                    setAccessError("That code doesn't match. Please try again.");
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

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <div className="text-sm font-bold tracking-tight text-white">
                Meta Retargeting
              </div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                Private beta
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Meta connected
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Launch a retargeting campaign
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-zinc-400">
            Re-engage your website visitors in four quick steps. Your campaign
            is created in paused status, so you review everything before it
            spends a cent.
          </p>
        </div>

        <div className="space-y-6">
          {/* STEP 1 — Ad account */}
          <section className={cardClasses}>
            <StepHeader
              step={1}
              title="Select your ad account"
              subtitle="We'll detect the campaign and pixel for this account automatically."
            />

            <div className="mt-5">
              <select
                id="adAccount"
                value={selectedAdAccountId}
                onChange={(e) => {
                  setSelectedAdAccountId(e.target.value);
                  setFormError("");
                  setResult(null);
                }}
                className={selectClasses}
                disabled={adAccountsLoading}
              >
                <option value="">
                  {adAccountsLoading
                    ? "Loading ad accounts..."
                    : "Select an ad account"}
                </option>

                {adAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name || account.id} (
                    {normalizeAccountId(account.id)})
                  </option>
                ))}
              </select>

              {adAccountsError && <ErrorNote>{adAccountsError}</ErrorNote>}
            </div>

            {!selectedAdAccountId ? null : isSetupReady ? (
              <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <CheckIcon />
                  Account is ready to launch
                </div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-zinc-500">Campaign</dt>
                    <dd className="text-zinc-200">
                      {selectedCampaignName || "Detected"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-zinc-500">Pixel</dt>
                    <dd className="text-zinc-200">
                      {selectedPixelName || "Detected"}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] p-4">
                <div className="text-sm font-semibold text-amber-300">
                  Finishing account setup
                </div>
                <ul className="mt-2 space-y-1 text-sm text-amber-200/90">
                  {setupIssues.map((issue) => (
                    <li key={issue} className="flex items-center gap-2">
                      {(campaignsLoading || pixelsLoading) && (
                        <Spinner className="h-3 w-3" />
                      )}
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowTechnicalDetails((current) => !current)}
              className="mt-4 text-xs font-medium text-zinc-500 underline-offset-4 transition hover:text-zinc-300 hover:underline"
            >
              {showTechnicalDetails
                ? "Hide advanced settings"
                : "Advanced settings"}
            </button>

            {showTechnicalDetails ? (
              <div className="mt-4 space-y-4 rounded-xl border border-white/5 bg-black/20 p-4">
                <p className="text-xs leading-relaxed text-zinc-500">
                  Your Facebook Page is selected automatically during launch.
                  Override the detected campaign or pixel below only if you
                  need to.
                </p>

                <div>
                  <FieldLabel htmlFor="campaignId">Campaign</FieldLabel>
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
                  <FieldLabel htmlFor="pixelId">Pixel</FieldLabel>
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
                </div>
              </div>
            ) : null}
          </section>

          {/* STEP 2 — Launch mode */}
          <section className={cardClasses}>
            <StepHeader
              step={2}
              title="Choose your creative"
              subtitle="Reusing a proven ad is the fastest path to launch."
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                className={`rounded-xl border p-4 text-left transition ${
                  mode === "existing"
                    ? "border-blue-400/60 bg-blue-500/10 ring-2 ring-blue-500/20"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    Reuse an existing ad
                  </span>
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-300">
                    Recommended
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                  Keep the creative that already works. Launch in under a
                  minute.
                </p>
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
                className={`rounded-xl border p-4 text-left transition ${
                  mode === "new"
                    ? "border-blue-400/60 bg-blue-500/10 ring-2 ring-blue-500/20"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
              >
                <span className="text-sm font-semibold text-white">
                  Create a new ad
                </span>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                  Write fresh copy and link it to your product page.
                </p>
              </button>
            </div>
          </section>

          {/* STEP 3 — Creative details */}
          <section className={cardClasses}>
            <StepHeader
              step={3}
              title={
                mode === "existing"
                  ? "Pick the ad to retarget"
                  : "Write your new ad"
              }
              subtitle={
                mode === "existing"
                  ? "We'll reuse this ad's creative for your retargeting audience."
                  : "Your Facebook Page is selected automatically during launch."
              }
            />

            {mode === "existing" ? (
              <div className="mt-5">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <FieldLabel htmlFor="existingAdId">Source ad</FieldLabel>
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
                    className={`${secondaryButtonClasses} h-[50px] px-3.5`}
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
                        Create a new ad
                      </span>{" "}
                      in Step 2 to write one from scratch.
                    </NeutralNote>
                  )}

                {previewLoading && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
                    <Spinner />
                    Loading ad preview...
                  </div>
                )}

                {previewError && <ErrorNote>{previewError}</ErrorNote>}

                {previewData && !previewLoading && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                    <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Creative preview
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                        <CheckIcon />
                        Ready to reuse
                      </span>
                    </div>
                    <dl className="space-y-2.5 px-4 py-4 text-sm">
                      <div>
                        <dt className="text-xs text-zinc-500">Ad name</dt>
                        <dd className="mt-0.5 text-zinc-100">
                          {previewData.adName || selectedAdName || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-zinc-500">Message</dt>
                        <dd className="mt-0.5 leading-relaxed text-zinc-100">
                          {previewData.message || "—"}
                        </dd>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <dt className="text-xs text-zinc-500">Headline</dt>
                          <dd className="mt-0.5 text-zinc-100">
                            {previewData.headline || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-zinc-500">
                            Description
                          </dt>
                          <dd className="mt-0.5 text-zinc-100">
                            {previewData.description || "—"}
                          </dd>
                        </div>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 grid gap-5">
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
                  <p className="mt-1.5 text-xs text-zinc-500">
                    This is the main text people see above your ad.
                  </p>
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

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="productName">Product name</FieldLabel>
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
              </div>
            )}
          </section>

          {/* STEP 4 — Budget & launch */}
          <section className={cardClasses}>
            <StepHeader
              step={4}
              title="Set budget & launch"
              subtitle="Everything launches paused — review it in Ads Manager before it spends."
            />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="budget">Daily budget</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
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
                    className={`${inputClasses} pl-9`}
                  />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="days">Audience window</FieldLabel>
                <select
                  id="days"
                  value={days}
                  onChange={(e) => {
                    setDays(Number(e.target.value));
                    setFormError("");
                  }}
                  className={selectClasses}
                >
                  <option value={7}>Last 7 days of visitors</option>
                  <option value={14}>Last 14 days of visitors</option>
                  <option value={30}>Last 30 days of visitors</option>
                </select>
              </div>
            </div>

            {/* Launch summary */}
            <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Launch summary
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <SummaryRow label="Ad account">
                  <span className="font-mono text-[13px]">
                    {normalizedSelectedAdAccountId || "—"}
                  </span>
                </SummaryRow>
                <SummaryRow label="Creative">
                  {mode === "existing"
                    ? selectedAdName || existingAdId || "—"
                    : productName.trim()
                      ? `New ad — ${productName.trim()}`
                      : "New ad"}
                </SummaryRow>
                <SummaryRow label="Audience">
                  Website visitors, last {days} days
                </SummaryRow>
                <SummaryRow label="Budget">€{budget} / day</SummaryRow>
                <SummaryRow label="Status at launch">
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                    Paused — you activate it
                  </span>
                </SummaryRow>
              </dl>
            </div>

            {(formError || validationError) && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-200">
                <svg
                  viewBox="0 0 24 24"
                  className="mt-0.5 h-4 w-4 shrink-0"
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
              className={`${primaryButtonClasses} mt-5`}
            >
              {loading ? (
                <>
                  <Spinner />
                  Creating your campaign...
                </>
              ) : (
                "Launch retargeting campaign"
              )}
            </button>

            <p className="mt-3 text-center text-xs text-zinc-500">
              No charges until you activate the campaign in Meta Ads Manager.
            </p>
          </section>

          {/* Result */}
          {result && (
            <section
              className={`rounded-2xl border p-6 shadow-xl shadow-black/20 ${
                result.ok
                  ? "border-emerald-400/25 bg-emerald-950/40"
                  : "border-red-400/25 bg-red-950/40"
              }`}
            >
              {result.ok ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
                      <CheckIcon className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-white">
                        Your retargeting campaign is ready
                      </h2>
                      <p className="text-sm text-emerald-200/80">
                        Created in paused status — activate it whenever you're
                        ready.
                      </p>
                    </div>
                  </div>

                  <ul className="mt-5 space-y-2.5 text-sm text-zinc-200">
                    <li className="flex items-center gap-2.5">
                      <CheckIcon />
                      Custom audience created — visitors from the last {days}{" "}
                      days
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckIcon />
                      Ad set created with a €{budget}/day budget (paused)
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckIcon />
                      {result.reusedCreativeId
                        ? "Ad created — your existing creative was reused"
                        : "Ad created from your new copy"}
                    </li>
                  </ul>

                  <a
                    href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${stripAccountId(
                      selectedAdAccountId
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${primaryButtonClasses} mt-6`}
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

                  <details className="mt-5">
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
                        <div>Reused creative ID: {result.reusedCreativeId}</div>
                      )}
                    </dl>
                  </details>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5 text-red-300"
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
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-white">
                        Launch didn't complete
                      </h2>
                      <p className="text-sm text-red-200/80">
                        Nothing was charged. Adjust the inputs and try again.
                      </p>
                    </div>
                  </div>

                  {result.step && (
                    <div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      Failed at step:{" "}
                      <span className="font-semibold">{result.step}</span>
                    </div>
                  )}

                  {typeof result.error === "string" && (
                    <p className="mt-3 text-sm leading-relaxed text-zinc-200">
                      {result.error}
                    </p>
                  )}

                  <details className="mt-4">
                    <summary className="cursor-pointer text-xs font-medium text-zinc-500 transition hover:text-zinc-300">
                      Show full error details
                    </summary>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/30 p-4 font-mono text-xs leading-relaxed text-zinc-400">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>

                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setFormError("");
                    }}
                    className={`${secondaryButtonClasses} mt-5`}
                  >
                    Dismiss and try again
                  </button>
                </>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-14 border-t border-white/5 pt-6 text-center text-xs text-zinc-600">
          All campaigns are created via Meta's official Marketing API and start
          in paused status.
        </footer>
      </div>
    </main>
  );
}

/* ---------------- */
/*  Tiny components */
/* ---------------- */

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-32 shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-zinc-100">{children}</dd>
    </div>
  );
}

function CheckIcon({ className = "h-4 w-4 text-emerald-400" }: { className?: string }) {
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

/* -------- */
/*  Utils   */
/* -------- */

function normalizeAccountId(id: string) {
  return id.startsWith("act_") ? id : `act_${id}`;
}

function stripAccountId(id: string) {
  return id.startsWith("act_") ? id.slice(4) : id;
}
