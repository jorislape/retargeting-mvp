import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

/* Next.js loads .env.local itself, but drizzle-kit does not — pull it
   in here so db:migrate / db:push / db:studio work locally. */
config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./modules/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
