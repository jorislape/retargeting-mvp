"use client";

import { useMemo, useState } from "react";

type LaunchMode = "existing" | "new";

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
        return "Existing Ad ID is required.";
      }

      if (!/^\d+$/.test(existingAdId.trim())) {
        return "Existing Ad ID should contain only numbers.";
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

  function resetResultAndError() {
    setFormError("");
    setResult(null);
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

  return (
    <main style={{ padding: 40, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        🚀 One-Click Meta Retargeting
      </h1>
      <p style={{ opacity: 0.7 }}>
        Launch retargeting ads in seconds.
      </p>

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
              resetResultAndError();
            }}
            style={modeButtonStyle(mode === "existing")}
          >
            Retarget Winning Ad
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("new");
              resetResultAndError();
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
              Existing Ad ID
            </label>
            <input
              id="existingAdId"
              placeholder="Paste an existing Meta Ad ID"
              value={existingAdId}
              onChange={(e) => {
                setExistingAdId(e.target.value);
                setFormError("");
              }}
              style={inputStyle}
            />
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Example: 120234142880930745
            </div>
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