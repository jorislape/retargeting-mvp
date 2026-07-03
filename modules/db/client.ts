import { neon } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/* Lazy singleton: importing this module never throws, so `next build`
   and DB-less local dev keep working. Only the first actual query
   requires DATABASE_URL. */

export type Db = NeonHttpDatabase<typeof schema>;

let instance: Db | null = null;

export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getDb(): Db {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Provision Neon (vercel integration add neon) and add it to .env.local"
      );
    }
    instance = drizzle(neon(url), { schema });
  }
  return instance;
}
