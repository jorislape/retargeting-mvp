import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* /vs-chatgpt stays the canonical, indexable URL (see app/sitemap.ts
     and its alternates.canonical) — /vs-ai exists only as a permanent
     redirect target for anyone who types or links the shorter name. */
  async redirects() {
    return [
      {
        source: "/vs-ai",
        destination: "/vs-chatgpt",
        permanent: true,
      },
    ];
  },
  /* Paid Pilot Readiness V1 — baseline security response headers only
     (no CSP: that needs its own scoped pass given the OAuth popup/
     postMessage flow it has to coexist with).
     HSTS + nosniff are safe everywhere, including /api/meta — neither
     touches cookies, tokens, or redirects. Referrer-Policy is scoped
     to exclude /api/meta specifically: modules/meta/bridge.ts already
     sets its own, stricter "no-referrer" on the token-bearing bridge
     response, and that existing, intentional value must stay the only
     one those routes ever see. */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/((?!api/meta).*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
