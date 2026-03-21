"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LaunchMode = "existing" | "new";

type MetaAdOption = {
  id: string;
  name: string;
  status?: string | null;
};

export default function DashboardPage() {
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

  const hasTriedLoadingAds = useRef(false);
  const previewRequestIdRef = useRef(0);

  function isValidUrl(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  const validationError = useMemo(() => {
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
  }, [mode, existingAdId, message, link, productName, budget, days]);

  const isFormValid = !validationError;

  async function loadAds() {
    try {
      setAdsLoading(true);
      setAdsError("");

      const res = await fetch("/api/meta/list-ads", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load ads.");
      }

      setAds(data.ads || []);
    } catch (err: any) {
      setAdsError(err?.message || "Failed to load ads.");
      setAds([]);
    } finally {
      setAdsLoading(false);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    if (mode !== "existing") return;
    if (hasTriedLoadingAds.current) return;

    hasTriedLoadingAds.current = true;
    loadAds();
  }, [unlocked, mode]);

  async function handlePreviewAd(adIdOverride?: string) {
    const adIdToUse = (adIdOverride ?? existingAdId).trim();

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
    if (mode !== "existing") return;

    const trimmedAdId = existingAdId.trim();

    if (!trimmedAdId) {
      previewRequestIdRef.current += 1;
      setPreviewLoading(false);
      setPreviewError("");
      setPreviewData(null);
      return;
    }

    handlePreviewAd(trimmedAdId);
  }, [existingAdId, mode, unlocked]);

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
              audienceName: `Visitors ${days}d`,
              retentionSeconds: days * 86400,
              dailyBudget: budget * 100,
              existingAdId: existingAdId.trim(),
            }
          : {
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

      if (!res.ok || !data.ok) {
        setResult(data);
        return;
      }

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

  return (
    <main style={{ padding: 40, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        🚀 One-Click Meta Retargeting
      </h1>
      <p style={{ opacity: 0.7 }}>Launch retargeting ads in seconds.</p>

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
            ? "Reuse the creative from an existing Meta ad. This is the main workflow."
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
              disabled={adsLoading}
            >
              <option value="">
                {adsLoading ? "Loading ads..." : "Select an existing Meta ad"}
              </option>

              {ads.map((ad) => (
                <option key={ad.id} value={ad.id}>
                  {ad.name} ({ad.id}){ad.status ? ` — ${ad.status}` : ""}
                </option>
              ))}
            </select>

            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Pick an ad from your account instead of pasting the ID manually.
            </div>

            {adsError && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: "#450a0a",
                  color: "#fecaca",
                  fontSize: 14,
                }}
              >
                {adsError}
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
                disabled={adsLoading}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background: adsLoading ? "#111" : "#1f2937",
                  color: "white",
                  fontWeight: 600,
                  cursor: adsLoading ? "not-allowed" : "pointer",
                  opacity: adsLoading ? 0.7 : 1,
                }}
              >
                {adsLoading ? "Refreshing..." : "Refresh Ads"}
              </button>

              <button
                type="button"
                onClick={() => handlePreviewAd()}
                disabled={previewLoading || !existingAdId.trim()}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #333",
                  background:
                    previewLoading || !existingAdId.trim()
                      ? "#111"
                      : "#1f2937",
                  color: "white",
                  fontWeight: 600,
                  cursor:
                    previewLoading || !existingAdId.trim()
                      ? "not-allowed"
                      : "pointer",
                  opacity: previewLoading || !existingAdId.trim() ? 0.7 : 1,
                }}
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

            {previewError && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: "#450a0a",
                  color: "#fecaca",
                  fontSize: 14,
                }}
              >
                {previewError}
              </div>
            )}

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
          disabled={loading || !isFormValid}
          style={{
            padding: "14px",
            fontSize: 16,
            borderRadius: 8,
            border: "none",
            cursor: loading || !isFormValid ? "not-allowed" : "pointer",
            background: loading || !isFormValid ? "#1e3a8a" : "#2563eb",
            color: "white",
            fontWeight: 700,
            opacity: loading || !isFormValid ? 0.7 : 1,
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
            borderRadius: 8,
            background: result.ok ? "#052e16" : "#450a0a",
            color: "white",
          }}
        >
          {result.ok ? (
            <>
              <div>✅ Retargeting launched</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>
                Audience ID: {result.audienceId}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                Ad Set ID: {result.adsetId}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                Ad ID: {result.adId}
              </div>
              {result.reusedCreativeId && (
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  Reused Creative ID: {result.reusedCreativeId}
                </div>
              )}
            </>
          ) : (
            <>
              <div>❌ Launch failed</div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  marginTop: 12,
                  marginBottom: 0,
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

const inputStyle = {
  width: "100%",
  padding: 12,
  fontSize: 16,
  borderRadius: 8,
  border: "1px solid #333",
  background: "#111",
  color: "#fff",
} as const;