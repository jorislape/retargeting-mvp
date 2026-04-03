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
    campaigns.find((campaign) => campaign.id === selectedCampaignId)?.name || "";
  const selectedPixelName =
    pixels.find((pixel) => pixel.id === selectedPixelId)?.name || "";
  const selectedAdName =
    ads.find((ad) => ad.id === existingAdId)?.name || "";

  const setupIssues = useMemo(() => {
    const issues: string[] = [];

    if (!selectedAdAccountId.trim()) {
      issues.push("Select an ad account.");
    }

    if (!selectedCampaignId.trim()) {
      if (campaignsLoading) {
        issues.push("Loading campaign...");
      } else if (campaignsError) {
        issues.push("Could not load campaign.");
      } else {
        issues.push("No campaign available.");
      }
    }

    if (!selectedPixelId.trim()) {
      if (pixelsLoading) {
        issues.push("Loading pixel...");
      } else if (pixelsError) {
        issues.push("Could not load pixel.");
      } else {
        issues.push("No pixel available.");
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

  if (!unlocked) {
    return (
      <main style={pageStyleNarrow}>
        <h1 style={pageTitleStyle}>🔒 Access Required</h1>
        <p style={mutedTextStyle}>
          Enter the dashboard access code to continue.
        </p>

        <input
          type="password"
          placeholder="Enter access code"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          style={inputStyle}
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
          style={primaryButtonStyle(false)}
        >
          Unlock Dashboard
        </button>
      </main>
    );
  }

  if (connected === null) {
    return (
      <main style={pageStyle}>
        <h1 style={pageTitleStyle}>🚀 One-Click Meta Retargeting</h1>
        <p style={mutedTextStyle}>Checking Meta connection...</p>
      </main>
    );
  }

  if (!connected) {
    return (
      <main style={pageStyle}>
        <h1 style={pageTitleStyle}>🚀 One-Click Meta Retargeting</h1>
        <p style={{ ...mutedTextStyle, marginBottom: 20 }}>
          Connect your Meta account to continue.
        </p>

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Meta connection required</div>
          <div style={sectionSubtextStyle}>
            Your dashboard is unlocked, but there is no active Meta session yet.
          </div>

          <div
            style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}
          >
            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/meta/oauth/start";
              }}
              style={primaryButtonStyle(false)}
            >
              Connect Meta
            </button>

            <button
              type="button"
              onClick={() => {
                checkSession();
              }}
              style={secondaryButtonStyle(false)}
            >
              Refresh Status
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1 style={pageTitleStyle}>🚀 One-Click Meta Retargeting</h1>
      <p style={mutedTextStyle}>
        Launch retargeting fast with the fewest possible decisions.
      </p>

      <div style={successBannerStyle}>Meta account connected.</div>

      <section style={cardStyle}>
        <div style={stepLabelStyle}>Step 1</div>
        <div style={sectionTitleStyle}>Choose ad account</div>
        <div style={sectionSubtextStyle}>
          We will automatically detect the required assets for this account.
        </div>

        <div style={{ marginTop: 14 }}>
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
        </div>

        {!selectedAdAccountId ? null : isSetupReady ? (
          <div style={setupReadyBoxStyle}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Setup detected</div>
            <div>Campaign: {selectedCampaignName || "Detected"}</div>
            <div>Pixel: {selectedPixelName || "Detected"}</div>
          </div>
        ) : (
          <div style={warningBoxStyle}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Setup needed before launch
            </div>
            {setupIssues.map((issue) => (
              <div key={issue}>• {issue}</div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowTechnicalDetails((current) => !current)}
            style={secondaryButtonStyle(false)}
          >
            {showTechnicalDetails
              ? "Hide technical details"
              : "Show technical details"}
          </button>
        </div>

        {showTechnicalDetails ? (
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <div style={neutralBoxStyle}>
              Facebook Page is now selected automatically during launch to reduce setup mistakes.
            </div>

            <div>
              <label htmlFor="campaignId" style={labelStyle}>
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
              <label htmlFor="pixelId" style={labelStyle}>
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
      </section>

      <section style={cardStyle}>
        <div style={stepLabelStyle}>Step 2</div>
        <div style={sectionTitleStyle}>Choose how to launch</div>
        <div style={sectionSubtextStyle}>
          Start with the fastest path. Creating a new ad is more manual.
        </div>

        <div
          style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}
        >
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
            Retarget existing ad • Recommended
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
            Create new ad
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={stepLabelStyle}>Step 3</div>
        <div style={sectionTitleStyle}>
          {mode === "existing" ? "Pick the source ad" : "Enter the new ad details"}
        </div>
        <div style={sectionSubtextStyle}>
          {mode === "existing"
            ? "We will reuse the creative from the selected ad."
            : "Facebook Page is selected automatically during launch."}
        </div>

        {mode === "existing" ? (
          <div style={{ marginTop: 14 }}>
            <label htmlFor="existingAdId" style={labelStyle}>
              Existing ad
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

            {adsError && <div style={errorBoxStyle}>{adsError}</div>}

            {!adsLoading && !adsError && selectedAdAccountId && ads.length === 0 && (
              <div style={neutralBoxStyle}>No ads found in this account.</div>
            )}

            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
              Ad preview loads automatically when you select an ad.
            </div>

            <div
              style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}
            >
              <button
                type="button"
                onClick={() => {
                  hasTriedLoadingAds.current = false;
                  loadAds();
                }}
                disabled={adsLoading || !selectedAdAccountId}
                style={secondaryButtonStyle(adsLoading || !selectedAdAccountId)}
              >
                {adsLoading ? "Refreshing..." : "Reload ad list"}
              </button>
            </div>

            {previewLoading && (
              <div style={neutralBoxStyle}>Loading source ad preview...</div>
            )}

            {previewError && <div style={errorBoxStyle}>{previewError}</div>}

            {previewData && (
              <div style={previewCardStyle}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>
                  Source ad preview
                </div>

                <div style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.7 }}>
                  <div>Ad name: {previewData.adName || selectedAdName || "—"}</div>
                  <div>Message: {previewData.message || "—"}</div>
                  <div>Headline: {previewData.headline || "—"}</div>
                  <div>Description: {previewData.description || "—"}</div>
                </div>

                <div style={{ marginTop: 10, fontSize: 13, color: "#86efac" }}>
                  Ready to reuse this creative.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 16 }}>
            <div style={neutralBoxStyle}>
              New ad creation is more manual right now, but Facebook Page is now auto-selected during launch.
            </div>

            <div>
              <label htmlFor="message" style={labelStyle}>
                Ad message
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
              <label htmlFor="link" style={labelStyle}>
                Destination link
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
              <label htmlFor="productName" style={labelStyle}>
                Product name
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
              <label htmlFor="description" style={labelStyle}>
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
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={stepLabelStyle}>Step 4</div>
        <div style={sectionTitleStyle}>Budget and launch</div>
        <div style={sectionSubtextStyle}>
          Review the essentials, then launch the retargeting setup.
        </div>

        <div
          style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="budget" style={labelStyle}>
              Daily budget (€)
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
            />
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="days" style={labelStyle}>
              Audience window
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

        <div style={launchSummaryStyle}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Launch summary</div>
          <div>Account: {normalizedSelectedAdAccountId || "—"}</div>
          <div>Mode: {mode === "existing" ? "Retarget existing ad" : "Create new ad"}</div>
          {mode === "existing" ? (
            <div>Ad: {selectedAdName || existingAdId || "—"}</div>
          ) : (
            <div>Product: {productName.trim() || "—"}</div>
          )}
          <div>Budget: €{budget}/day</div>
          <div>Window: {days} days</div>
        </div>

        {(formError || validationError) && (
          <div style={inlineWarningStyle}>{formError || validationError}</div>
        )}

        <button
          onClick={handleLaunchRetargeting}
          disabled={isLaunchBlocked}
          style={primaryButtonStyle(isLaunchBlocked)}
        >
          {loading
            ? "Launching..."
            : mode === "existing"
              ? "Launch retargeting"
              : "Launch new retargeting ad"}
        </button>
      </section>

      {result && (
        <section
          style={{
            ...cardStyle,
            background: result.ok ? "#052e16" : "#450a0a",
            border: result.ok ? "1px solid #166534" : "1px solid #7f1d1d",
          }}
        >
          {result.ok ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                ✅ Retargeting launched
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 14,
                  lineHeight: 1.6,
                  opacity: 0.95,
                }}
              >
                Your retargeting setup was created successfully and saved in
                paused status inside Meta.
              </div>

              <div style={resultInnerBoxStyle}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  What was created
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                  <div>• Custom Audience created</div>
                  <div>• Ad Set created in paused status</div>
                  <div>• Ad created in paused status</div>
                  {result.reusedCreativeId ? (
                    <div>• Existing creative reused successfully</div>
                  ) : (
                    <div>• New creative generated from your inputs</div>
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  fontSize: 12,
                  opacity: 0.85,
                  lineHeight: 1.7,
                }}
              >
                <div>Ad Account: {normalizeAccountId(selectedAdAccountId)}</div>
                <div>Page ID used: {result.pageId || "—"}</div>
                <div>
                  Campaign: {selectedCampaignName || selectedCampaignId || "—"}
                </div>
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
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                ❌ Launch failed
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 14,
                  lineHeight: 1.6,
                  opacity: 0.95,
                }}
              >
                The retargeting setup could not be completed.
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
        </section>
      )}
    </main>
  );
}

function normalizeAccountId(id: string) {
  return id.startsWith("act_") ? id : `act_${id}`;
}

const pageStyle = {
  padding: 40,
  maxWidth: 820,
  margin: "0 auto",
} as const;

const pageStyleNarrow = {
  padding: 40,
  maxWidth: 420,
  margin: "0 auto",
} as const;

const pageTitleStyle = {
  fontSize: 30,
  marginBottom: 8,
  fontWeight: 800,
} as const;

const mutedTextStyle = {
  opacity: 0.72,
  fontSize: 15,
  lineHeight: 1.6,
} as const;

const cardStyle = {
  marginTop: 24,
  padding: 18,
  borderRadius: 14,
  border: "1px solid #222",
  background: "#0b0b0b",
} as const;

const stepLabelStyle = {
  display: "inline-block",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase" as const,
  color: "#93c5fd",
  marginBottom: 8,
} as const;

const sectionTitleStyle = {
  fontSize: 18,
  fontWeight: 800,
  marginBottom: 6,
} as const;

const sectionSubtextStyle = {
  fontSize: 14,
  lineHeight: 1.6,
  opacity: 0.72,
} as const;

const labelStyle = {
  display: "block",
  marginBottom: 8,
  fontWeight: 600,
  fontSize: 14,
} as const;

const inputStyle = {
  width: "100%",
  padding: 12,
  fontSize: 16,
  borderRadius: 10,
  border: "1px solid #333",
  background: "#111",
  color: "#fff",
} as const;

function primaryButtonStyle(disabled: boolean) {
  return {
    marginTop: 16,
    padding: "14px 16px",
    width: "100%",
    borderRadius: 10,
    border: "none",
    background: disabled ? "#1e3a8a" : "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 15,
    opacity: disabled ? 0.7 : 1,
  } as const;
}

function secondaryButtonStyle(disabled: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #333",
    background: disabled ? "#111" : "#1f2937",
    color: "#fff",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
    fontSize: 14,
  } as const;
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

const successBannerStyle = {
  marginTop: 16,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #1f2937",
  background: "#0f172a",
  color: "#cbd5e1",
  fontSize: 13,
} as const;

const setupReadyBoxStyle = {
  marginTop: 14,
  padding: 14,
  borderRadius: 10,
  border: "1px solid #14532d",
  background: "#052e16",
  color: "#bbf7d0",
  fontSize: 14,
  lineHeight: 1.7,
} as const;

const warningBoxStyle = {
  marginTop: 14,
  padding: 14,
  borderRadius: 10,
  border: "1px solid #3f2a00",
  background: "#2a1800",
  color: "#fde68a",
  fontSize: 14,
  lineHeight: 1.6,
} as const;

const neutralBoxStyle = {
  marginTop: 12,
  padding: 12,
  borderRadius: 8,
  background: "#111827",
  color: "#cbd5e1",
  fontSize: 14,
  border: "1px solid #1f2937",
} as const;

const errorBoxStyle = {
  marginTop: 12,
  padding: 12,
  borderRadius: 8,
  background: "#450a0a",
  color: "#fecaca",
  fontSize: 14,
} as const;

const inlineWarningStyle = {
  marginTop: 14,
  padding: 12,
  borderRadius: 8,
  background: "#451a03",
  color: "#fde68a",
  fontSize: 14,
} as const;

const previewCardStyle = {
  marginTop: 12,
  padding: 14,
  borderRadius: 10,
  border: "1px solid #1f2937",
  background: "#0f172a",
  color: "#fff",
} as const;

const launchSummaryStyle = {
  marginTop: 16,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #1f2937",
  background: "#0f172a",
  fontSize: 13,
  color: "#cbd5e1",
  lineHeight: 1.7,
} as const;

const resultInnerBoxStyle = {
  marginTop: 14,
  padding: 12,
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
} as const;