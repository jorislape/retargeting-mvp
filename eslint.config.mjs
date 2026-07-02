import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // FROZEN retargeting module (see ARCHITECTURE.md). Pre-existing lint
    // debt is intentionally not fixed in frozen code; remove these ignores
    // if the module is ever revived.
    "app/dashboard/**",
    "app/launch/**",
    "components/LaunchReview.tsx",
    "app/api/meta/launch-retargeting/**",
    "app/api/meta/activate-retargeting/**",
    "app/api/meta/create-*/**",
    "app/api/meta/preview-ad/**",
    "app/api/meta/page-posts/**",
    "app/api/meta/list-ads/**",
    "app/api/meta/list-pages/**",
    "app/api/meta/list-pixels/**",
    "app/api/meta/list-campaigns/**",
    "app/api/meta/pages/**",
    "app/api/meta/pixels/**",
    "app/api/meta/account-config-status/**",
  ]),
]);

export default eslintConfig;
