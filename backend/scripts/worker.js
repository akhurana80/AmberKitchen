const { Client } = require("pg");

const intervalMs = Number(process.env.WORKER_INTERVAL_MS ?? 60000);

async function runCycle(client) {
  const cancelled = await client.query(
    `update orders
     set status = 'cancelled',
         cancellation_reason = 'Restaurant did not accept before auto-cancel deadline',
         cancelled_at = now(),
         updated_at = now()
     where status = 'created'
       and auto_cancel_at <= now()
     returning id`
  );

  for (const order of cancelled.rows) {
    await client.query(
      `insert into order_status_history (order_id, status, note)
       values ($1, 'cancelled', 'Auto-cancelled by operations worker')`,
      [order.id]
    );
  }

  const analytics = await client.query(
    `insert into analytics_jobs (job_type, status, summary, created_at)
     values ('hourly_marketplace_snapshot', 'queued', jsonb_build_object('queuedAt', now()), now())
     returning id`
  );

  console.log(JSON.stringify({
    level: "info",
    worker: "operations",
    autoCancelled: cancelled.rowCount,
    analyticsJobId: analytics.rows[0]?.id ?? null
  }));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  async function cycle() {
    try {
      await runCycle(client);
    } catch (error) {
      console.error(JSON.stringify({ level: "error", worker: "operations", message: error.message }));
    }
  }

  await cycle();
  if (process.env.WORKER_ONCE === "true") {
    await client.end();
    return;
  }

  const timer = setInterval(cycle, intervalMs);
  async function shutdown(signal) {
    clearInterval(timer);
    await client.end();
    console.log(JSON.stringify({ level: "info", worker: "operations", signal, message: "shutdown_complete" }));
    process.exit(0);
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
