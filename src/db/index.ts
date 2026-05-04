import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  return drizzle(neon(databaseUrl), { schema });
}

type DbClient = ReturnType<typeof createDb>;

let db: DbClient | null = null;

export function getDb(): DbClient {
  if (!db) {
    db = createDb();
  }

  return db;
}
