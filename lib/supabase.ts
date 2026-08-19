import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

import { existsSync } from "node:fs";

// Local dev reads .env; CI (GitHub Actions) injects real env vars directly.
if (existsSync(".env")) process.loadEnvFile();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY (set in .env locally, or as repo secrets in CI)");
}

export const supabase = createClient<Database>(url, key);
