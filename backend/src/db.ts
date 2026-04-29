import { Pool, PoolClient, QueryResultRow } from "pg";
import { config } from "./config";

export const db = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000
});

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  return db.query<T>(text, params);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
