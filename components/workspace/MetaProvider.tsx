"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MetaAdAccount, MetaOAuthMessage } from "@/modules/meta/types";

/* ------------------------------------------------------------------ */
/* Session-only Meta connection state. The access token lives in React */
/* state and NOWHERE else: no cookie, no localStorage, no server-side  */
/* session — a refresh disconnects, exactly like an uploaded CSV       */
/* disappears. This mirrors DebriefProvider on purpose; it's the same  */
/* privacy guarantee applied to the OAuth data source.                 */
/*                                                                     */
/* The OAuth popup hands the token back via postMessage. The listener  */
/* below only accepts messages whose event.origin strictly equals our  */
/* own origin AND whose source is the popup we opened — anything else  */
/* is dropped without logging.                                         */
/* ------------------------------------------------------------------ */

export type MetaStatus = "disconnected" | "connecting" | "connected";

interface MetaContextValue {
  status: MetaStatus;
  token: string | null;
  accounts: MetaAdAccount[];
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  /** Called by data routes' consumers when Meta says the token died. */
  expire: (message: string) => void;
}

const MetaContext = createContext<MetaContextValue | null>(null);

function isOAuthMessage(data: unknown): data is MetaOAuthMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "meta-oauth"
  );
}

export function MetaProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MetaStatus>("disconnected");
  const [token, setToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<MetaAdAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // One place to tear down the listener + poll between attempts and on
  // unmount.
  useEffect(() => () => cleanupRef.current?.(), []);

  const disconnect = useCallback(() => {
    cleanupRef.current?.();
    popupRef.current?.close();
    popupRef.current = null;
    setStatus("disconnected");
    setToken(null);
    setAccounts([]);
    setError(null);
  }, []);

  const expire = useCallback((message: string) => {
    cleanupRef.current?.();
    setStatus("disconnected");
    setToken(null);
    setAccounts([]);
    setError(message);
  }, []);

  const connect = useCallback(() => {
    cleanupRef.current?.();
    setError(null);

    const popup = window.open(
      "/api/meta/login",
      "meta-oauth",
      "popup=yes,width=620,height=780"
    );
    if (!popup) {
      setError(
        "Your browser blocked the sign-in window — allow popups for this site and try again."
      );
      return;
    }
    popupRef.current = popup;
    setStatus("connecting");

    let settled = false;

    const finishError = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      setStatus("disconnected");
      setError(message);
    };

    const onMessage = async (event: MessageEvent) => {
      // REQUIRED: exact-origin check, strict equality — no wildcards,
      // no endsWith. Messages from any other origin are ignored.
      if (event.origin !== window.location.origin) return;
      if (event.source !== popup) return;
      if (!isOAuthMessage(event.data)) return;

      if (settled) return;
      settled = true;
      cleanup();

      const message = event.data;
      if (!message.ok || !message.token) {
        setStatus("disconnected");
        setError(message.error ?? "Meta sign-in failed. Try again.");
        return;
      }

      // TEMPORARY: surfaces the sanitized ads_archive diagnostic
      // (modules/meta/graph.ts's checkAdsArchiveAccess) for manual
      // inspection. Only present when ADS_ARCHIVE_DIAGNOSTIC_ENABLED is
      // on server-side (default off) — never contains the token.
      // Remove alongside that flag once access is confirmed/ruled out.
      if (message.adsArchiveDiagnostic) {
        console.log("meta: ads_archive diagnostic", message.adsArchiveDiagnostic);
      }

      try {
        const res = await fetch("/api/meta/ad-accounts", {
          headers: { Authorization: `Bearer ${message.token}` },
          cache: "no-store",
        });
        const data = await res.json();
        if (!data.ok) {
          setStatus("disconnected");
          setError(data.error ?? "Couldn't load your ad accounts.");
          return;
        }
        if (!Array.isArray(data.accounts) || data.accounts.length === 0) {
          setStatus("disconnected");
          setError(
            "No ad accounts are visible to this Meta login. Check your access in Business Manager."
          );
          return;
        }
        setToken(message.token);
        setAccounts(data.accounts);
        setStatus("connected");
      } catch {
        setStatus("disconnected");
        setError("Network error while finishing the Meta connection.");
      }
    };

    // The bridge posts, then closes. If the popup closes while we're
    // still "connecting", give the in-flight message a beat to arrive
    // before calling it abandoned.
    const closedPoll = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(closedPoll);
        window.setTimeout(() => {
          finishError("The Meta sign-in window was closed before finishing.");
        }, 500);
      }
    }, 400);

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(closedPoll);
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;

    window.addEventListener("message", onMessage);
  }, []);

  const value = useMemo(
    () => ({ status, token, accounts, error, connect, disconnect, expire }),
    [status, token, accounts, error, connect, disconnect, expire]
  );

  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}

export function useMeta(): MetaContextValue {
  const ctx = useContext(MetaContext);
  if (!ctx) throw new Error("useMeta must be used inside MetaProvider");
  return ctx;
}
