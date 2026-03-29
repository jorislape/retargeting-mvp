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

type MetaPageOption = {
  id: string;
  name: string;
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

export default function DashboardPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);

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

  const [pages, setPages] = useState<MetaPageOption[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesError, setPagesError] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");

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

  const setupIssues = useMemo(() => {
    const issues: string[] = [];

    if (!selectedAdAccountId.trim()) {
      issues.push("Select an ad account.");
    }

    if (!selectedPageId.trim()) {
      if (pagesLoading) {
        issues.push("Loading your Facebook Pages...");
      } else if (pagesError) {
        issues.push("We could not load your Facebook Pages.");
      } else {
        issues.push("No Facebook Page available for this account connection.");
      }
    }

    if (!selectedCampaignId.trim()) {
      if (campaignsLoading) {
        issues.push("Loading campaigns...");
      } else if (campaignsError) {
        issues.push("We could not load campaigns for this ad account.");
      } else {
        issues.push("No campaign available for the selected ad account.");
      }
    }

    if (!selectedPixelId.trim()) {
      if (pixelsLoading) {
        issues.push("Loading pixel...");
      } else if (pixelsError) {
        issues.push("We could not load pixels for this ad account.");
      } else {
        issues.push("No pixel available for the selected ad account.");
      }
    }

    return issues;
  }, [
    selectedAdAccountId,
    selectedPageId,
    selectedCampaignId,
    selectedPixelId,
    pagesLoading,
    pagesError,
    campaignsLoading,
    campaignsError,
    pixelsLoading,
    pixelsError,
  ]);

  const validationError = useMemo(() => {
    if (!selectedAdAccountId.trim()) {
      return "Please select an ad account.";
    }

    if (!selectedPageId.trim()) {
      return "A Facebook Page is required before you can launch.";
    }

    if (!selectedCampaignId.trim()) {
      return "A campaign is required before you can launch.";
    }

    if (!selectedPixelId.trim()) {
      return "A pixel is required before you can launch.";
    }

    if (!Number.isFinite(budget) || budget < 1) {
      return "Daily Budget must be at least €1.";
    }

    if (![7, 14, 30].includes(days)) {
      return "Audience Window must be 7, 14, or 30 days.";
    }

    if (mode === "existing") {
      if (!existingAdId.trim()) {
        return "Please select an existing ad.";
      }

      if (!/^\d+$/.test(existingAdId.trim())) {
        return "Selected Ad ID is invalid.";
      }

      return "";
    }

    if (!message.trim()) return "Ad Message is required.";
    if (!link.trim()) return "Destination Link is required.";
    if (!isValidUrl(link.trim())) return "Please enter a valid URL.";
    if (!productName.trim()) return "Product Name is required.";

    return "";
  }, [
    selectedAdAccountId,
    selectedPageId,
    selectedCampaignId,
    selectedPixelId,
    mode,
    existingAdId,
    message,
    link,
    productName,
    budget,
    days,
  ]);

  const isFormValid = !validationError;
  const isLaunchBlocked = loading || !isFormValid;

  const selectedPageName =
    pages.find((page) => page.id === selectedPageId)?.name || "";
  const selectedCampaignName =
    campaigns.find((campaign) => campaign.id === selectedCampaignId)?.name || "";
  const selectedPixelName =
    pixels.find((pixel) => pixel.id === selectedPixelId)?.name || "";

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

  async function loadPages() {
    try {
      setPagesLoading(true);
      setPagesError("");

      const res = await fetch("/api/meta/list-pages", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load pages.");
      }

      const nextPages: MetaPageOption[] = Array.isArray(data.pages)
        ? data.pages
        : [];

      setPages(nextPages);

      setSelectedPageId((current) => {
        if (current && nextPages.some((page) => page.id === current)) {
          return current;
        }

        return nextPages[0]?.id || "";
      });
    } catch (err: any) {
      setPages([]);
      setSelectedPageId("");
      setPagesError(err?.message || "Failed to load pages.");
    } finally {
      setPagesLoading(false);
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
        throw new Error("No ad account selected");
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
    if (!unlocked) return;
    if (!connected) return;

    loadAdAccounts();
    loadPages();
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
    if (!unlocked) return;
    if (!connected) return;
    if (!selectedAdAccountId.trim()) return;

    loadCampaigns(selectedAdAccountId);
    loadPixels(selectedAdAccountId);
  }, [unlocked, connected, selectedAdAccountId]);

  useEffect(() => {
    if (!unlocked) return;
    if (!connected) return;
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
      setPreviewError("Existing Ad ID is required.");
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

      if (requestId !== previewRequestIdRef.current) {
        return;
      }

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
      if (requestId !== previewRequestIdRef.current) {
        return;
      }

      setPreviewData(null);
      setPreviewError("Preview request failed.");
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setPreviewLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    if (!connected) return;
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
              pageId: selectedPageId,
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
              pageId: selectedPageId,
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

  if (!unlocked) {
    return (
      <main style={{ padding: 40, maxWidth: 420, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>🔒 Access Required</h1>
        <p style={{ opacity: 0.7 }}>
          Enter the dashboard access code to continue.
        </p>

        <input
          type="password"
          placeholder="Enter access code"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginTop: 16,
            borderRadius: 8,
            border: "1px solid #333",
            background: "#111",
            color: "#fff",
            fontSize: 16,
          }}
        />

        <button
          onClick={() => {
            if (
              accessCode === process.env.NEXT_PUBLIC_DASHBOARD_ACCESS_CODE
            ) {
              setUnlocked(true);
            } else {
              alert("Wrong code");
            }
          }}
          style={{
            marginTop: 12,
            padding: 12,
            width: "100%",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          Unlock Dashboard
        </button>
      </main>
    );
  }

  if (connected === null) {
    return (
      <main style={{ padding: 40, maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>
          🚀 One-Click Meta Retargeting
        </h1>
        <p style={{ opacity: 0.7 }}>Checking Meta connection...</p>
      </main>
    );
  }

  if (!connected) {
    return (
      <main style={{ padding: 40, maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>
          🚀 One-Click Meta Retargeting
        </h1>
        <p style={{ opacity: 0.7, marginBottom: 20 }}>
          Connect your Meta account to load ads and launch retargeting.
        </p>

        <div
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid #222",
            background: "#0b0b0b",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            Meta connection required
          </div>

          <div style={{ fontSize: 14, opacity: 0.75, lineHeight: 1.6 }}>
            Your dashboard is unlocked, but there is no active Meta session yet.
            Connect your account to continue.
          </div>

          <div
            style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}
          >
            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/meta/oauth/start";
              }}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Connect Meta
            </button>

            <button
              type="button"
              onClick={() => {
                checkSession();
              }}
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid #333",
                background: "#111",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Refresh Status
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 40, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        🚀 One-Click Meta Retargeting
      </h1>
      <p style={{ opacity: 0.7 }}>Launch retargeting ads in seconds.</p>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 10,
          border: "1px solid #1f2937",
          background: "#0f172a",
          color: "#cbd5e1",
          fontSize: 13,
        }}
      >
        Meta account connected.
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 12,
          border: "1px solid #222",
          background: "#0b0b0b",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          Ad Account
        </div>

        <select
          id="adAccount"
          value={selectedAdAccountId}
          onChange={(e) => {
            setSelectedAdAccountId(e.target.value);
            setFormError("");
            setResult(null);
          }}
          style={inputStyle}
          disabled={adAccountsLoading}
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

        {adAccountsError && <div style={errorBoxStyle}>{adAccountsError}</div>}

        {setupIssues.length > 0 ? (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 10,
              border: "1px solid #3f2a00",
              background: "#2a1800",
              color: "#fde68a",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Setup needed before launch
            </div>
            {setupIssues.map((issue) => (
              <div key={issue}>• {issue}</div>
            ))}
          </div>
        ) : (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 10,
              border: "1px solid #14532d",
              background: "#052e16",
              color: "#bbf7d0",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Ready to launch
            </div>
            <div>
              We found the required assets for this account and selected them automatically.
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowTechnicalDetails((current) => !current)}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #333",
              background: "#111",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {showTechnicalDetails ? "Hide technical details" : "Show technical details"}
          </button>
        </div>

        {showTechnicalDetails ? (
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 14,
            }}
          >
            <div>
              <label
                htmlFor="pageId"
                style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
              >
                Page
              </label>

              <select
                id="pageId"
                value={selectedPageId}
                onChange={(e) => {
                  setSelectedPageId(e.target.value);
                  setFormError("");
                  setResult(null);
                }}
                style={inputStyle}
                disabled={pagesLoading}
              >
                <option value="">
                  {pagesLoading ? "Loading pages..." : "Select a page"}
                </option>

                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name} ({page.id})
                  </option>
                ))}
              </select>

              {pagesError && <div style={errorBoxStyle}>{pagesError}</div>}
            </div>

            <div>
              <label
                htmlFor="campaignId"
                style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
              >
                Campaign
              </label>

              <select
                id="campaignId"
                value={selectedCampaignId}
                onChange={(e) => {
                  setSelectedCampaignId(e.target.value);
                  setFormError("");
                  setResult(null);
                }}
                style={inputStyle}
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

              {campaignsError && <div style={errorBoxStyle}>{campaignsError}</div>}
            </div>

            <div>
              <label
                htmlFor="pixelId"
                style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
              >
                Pixel
              </label>

              <select
                id="pixelId"
                value={selectedPixelId}
                onChange={(e) => {
                  setSelectedPixelId(e.target.value);
                  setFormError("");
                  setResult(null);
                }}
                style={inputStyle}
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

              {pixelsError && <div style={errorBoxStyle}>{pixelsError}</div>}
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 12,
          border: "1px solid #222",
          background: "#0b0b0b",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          Launch Mode
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
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
            style={modeButtonStyle(mode === "existing")}
          >
            Retarget Winning Ad
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
            style={modeButtonStyle(mode === "new")}
          >
            Create New Ad
          </button>
        </div>

        <div style={{ fontSize: 13, opacity: 0.72, marginTop: 10 }}>
          {mode === "existing"
            ? "Reuse the creative from an existing Meta ad."
            : "Create a new retargeting ad from scratch."}
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
        {mode === "existing" ? (
          <div>
            <label
              htmlFor="existingAdId"
              style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
            >
              Choose Existing Ad
            </label>

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
              style={inputStyle}
              disabled={adsLoading || !selectedAdAccountId}
            >
              <option value="">
                {adsLoading
                  ? "Loading ads..."
                  : !selectedAdAccountId
                    ? "Select an ad account first"
                    : "Select an existing Meta ad"}
              </option>

              {ads.map((ad) => (
                <option key={ad.id} value={ad.id}>
                  {ad.name} ({ad.id}){ad.status ? ` — ${ad.status}` : ""}
                </option>
              ))}
            </select>

            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Pick an ad from the selected account.
            </div>

            {adsError && <div style={errorBoxStyle}>{adsError}</div>}

            {!adsLoading && !adsError && selectedAdAccountId && ads.length === 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: "#111827",
                  color: "#cbd5e1",
                  fontSize: 14,
                  border: "1px solid #1f2937",
                }}
              >
                No ads found in this account.
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  hasTriedLoadingAds.current = false;
                  loadAds();
                }}
                disabled={adsLoading || !selectedAdAccountId}
                style={secondaryButtonStyle(
                  adsLoading || !selectedAdAccountId
                )}
              >
                {adsLoading ? "Refreshing..." : "Refresh Ads"}
              </button>

              <button
                type="button"
                onClick={() => handlePreviewAd()}
                disabled={
                  previewLoading ||
                  !existingAdId.trim() ||
                  !selectedAdAccountId.trim()
                }
                style={secondaryButtonStyle(
                  previewLoading ||
                    !existingAdId.trim() ||
                    !selectedAdAccountId.trim()
                )}
              >
                {previewLoading ? "Loading Preview..." : "Preview Source Ad"}
              </button>
            </div>

            {previewLoading && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: "#111827",
                  color: "#cbd5e1",
                  fontSize: 14,
                  border: "1px solid #1f2937",
                }}
              >
                Loading source ad preview...
              </div>
            )}

            {previewError && <div style={errorBoxStyle}>{previewError}</div>}

            {previewData && (
              <div
                style={{
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid #1f2937",
                  background: "#0f172a",
                  color: "white",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 10 }}>
                  Source Ad Preview
                </div>

                <div style={{ fontSize: 14, opacity: 0.85 }}>
                  <div>Ad ID: {previewData.adId}</div>
                  <div style={{ marginTop: 4 }}>
                    Ad Name: {previewData.adName || "—"}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Creative ID: {previewData.creativeId || "—"}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Message: {previewData.message || "—"}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Headline: {previewData.headline || "—"}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    Description: {previewData.description || "—"}
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 13, color: "#86efac" }}>
                  Ready to reuse this ad creative.
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <label
                htmlFor="message"
                style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
              >
                Ad Message
              </label>
              <textarea
                id="message"
                placeholder="Write your ad message..."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setFormError("");
                }}
                rows={4}
                style={inputStyle}
              />
            </div>

            <div>
              <label
                htmlFor="link"
                style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
              >
                Destination Link
              </label>
              <input
                id="link"
                placeholder="https://your-site.com/product"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setFormError("");
                }}
                style={inputStyle}
              />
            </div>

            <div>
              <label
                htmlFor="productName"
                style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
              >
                Product Name
              </label>
              <input
                id="productName"
                placeholder="Your product name"
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  setFormError("");
                }}
                style={inputStyle}
              />
            </div>

            <div>
              <label
                htmlFor="description"
                style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
              >
                Description
              </label>
              <input
                id="description"
                placeholder="Short description (optional)"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setFormError("");
                }}
                style={inputStyle}
              />
            </div>
          </>
        )}

        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #1f2937",
            background: "#0f172a",
            fontSize: 13,
            color: "#cbd5e1",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Launch Summary</div>
          <div>Ad Account: {normalizedSelectedAdAccountId || "—"}</div>
          <div>Page: {selectedPageName || "—"}</div>
          <div>Mode: {mode === "existing" ? "Retarget Winning Ad" : "Create New Ad"}</div>
          {mode === "existing" && <div>Selected Ad: {existingAdId || "—"}</div>}
          <div>Budget: €{budget}/day</div>
          <div>Window: {days} days</div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label
              htmlFor="budget"
              style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
            >
              Daily Budget (€)
            </label>
            <input
              id="budget"
              type="number"
              min="1"
              value={budget}
              onChange={(e) => {
                setBudget(Number(e.target.value));
                setFormError("");
              }}
              style={inputStyle}
              placeholder="e.g. 5"
            />
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <label
              htmlFor="days"
              style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
            >
              Audience Window
            </label>
            <select
              id="days"
              value={days}
              onChange={(e) => {
                setDays(Number(e.target.value));
                setFormError("");
              }}
              style={inputStyle}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
        </div>

        {(formError || validationError) && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#451a03",
              color: "#fde68a",
              fontSize: 14,
            }}
          >
            {formError || validationError}
          </div>
        )}

        <button
          onClick={handleLaunchRetargeting}
          disabled={isLaunchBlocked}
          style={{
            padding: "14px",
            fontSize: 16,
            borderRadius: 8,
            border: "none",
            cursor: isLaunchBlocked ? "not-allowed" : "pointer",
            background: isLaunchBlocked ? "#1e3a8a" : "#2563eb",
            color: "white",
            fontWeight: 700,
            opacity: isLaunchBlocked ? 0.7 : 1,
          }}
        >
          {loading
            ? "Launching..."
            : mode === "existing"
              ? "Launch Retargeting from Existing Ad"
              : "Launch New Retargeting Ad"}
        </button>
      </div>

      {result && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 10,
            background: result.ok ? "#052e16" : "#450a0a",
            color: "white",
            border: result.ok ? "1px solid #166534" : "1px solid #7f1d1d",
          }}
        >
          {result.ok ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                ✅ Retargeting launched
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  opacity: 0.9,
                  lineHeight: 1.5,
                }}
              >
                Your retargeting setup was created successfully and is currently
                saved in paused status inside Meta.
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  What was created
                </div>

                <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                  <div>• Custom Audience created</div>
                  <div>• Ad Set created in paused status</div>
                  <div>• Ad created in paused status</div>
                  {result.reusedCreativeId ? (
                    <div>• Existing winning creative reused successfully</div>
                  ) : (
                    <div>• New creative generated from the form inputs</div>
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  opacity: 0.8,
                  lineHeight: 1.7,
                }}
              >
                <div>Ad Account: {normalizeAccountId(selectedAdAccountId)}</div>
                <div>Page: {selectedPageName || selectedPageId || "—"}</div>
                <div>Campaign: {selectedCampaignName || selectedCampaignId || "—"}</div>
                <div>Pixel: {selectedPixelName || selectedPixelId || "—"}</div>
                <div>Audience ID: {result.audienceId}</div>
                <div>Ad Set ID: {result.adsetId}</div>
                <div>Ad ID: {result.adId}</div>
                {result.reusedCreativeId && (
                  <div>Reused Creative ID: {result.reusedCreativeId}</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                ❌ Launch failed
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  opacity: 0.9,
                  lineHeight: 1.5,
                }}
              >
                The retargeting setup could not be completed. Check the error
                details below.
              </div>

              {result.step && (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    color: "#fecaca",
                    fontWeight: 700,
                  }}
                >
                  Failed step: {result.step}
                </div>
              )}

              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  marginTop: 12,
                  marginBottom: 0,
                  fontSize: 12,
                  opacity: 0.95,
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function normalizeAccountId(id: string) {
  return id.startsWith("act_") ? id : `act_${id}`;
}

function modeButtonStyle(active: boolean) {
  return {
    padding: "12px 16px",
    borderRadius: 10,
    border: active ? "1px solid #2563eb" : "1px solid #333",
    background: active ? "#1d4ed8" : "#111",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  } as const;
}

function secondaryButtonStyle(disabled: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #333",
    background: disabled ? "#111" : "#1f2937",
    color: "white",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
    fontSize: 14,
  } as const;
}

const inputStyle = {
  width: "100%",
  padding: 12,
  fontSize: 16,
  borderRadius: 8,
  border: "1px solid #333",
  background: "#111",
  color: "#fff",
} as const;

const errorBoxStyle = {
  marginTop: 12,
  padding: 12,
  borderRadius: 8,
  background: "#450a0a",
  color: "#fecaca",
  fontSize: 14,
} as const;