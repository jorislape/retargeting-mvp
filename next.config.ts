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
};

export default nextConfig;
