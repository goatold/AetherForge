import { Pool } from "pg";

import type { SqlQuery } from "./types";

let pool: Pool | null = null;

const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for database access");
  }
  return url;
};

export const getDbPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl()
    });
  }

  return pool;
};

export async function executeQuery<Row extends Record<string, unknown>>(
  query: SqlQuery
) {
  const db = getDbPool();
  return db.query<Row>(query.text, query.values ? [...query.values] : []);
}
