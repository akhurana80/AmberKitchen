const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function migrationFiles() {
  const migrationsDir = path.join(__dirname, "../../database/migrations");
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith(".up.sql"))
    .sort()
    .map(file => ({
      id: file.replace(/\.up\.sql$/, ""),
      path: path.join(migrationsDir, file)
    }));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const schemaPath = path.join(__dirname, "../../database/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      `insert into schema_migrations (id)
       values ($1)
       on conflict (id) do nothing`,
      ["schema.sql"]
    );
    for (const migration of migrationFiles()) {
      const applied = await client.query("select 1 from schema_migrations where id = $1", [migration.id]);
      if (applied.rows[0]) {
        continue;
      }
      await client.query(fs.readFileSync(migration.path, "utf8"));
      await client.query("insert into schema_migrations (id) values ($1)", [migration.id]);
      console.log(`Applied migration ${migration.id}`);
    }
    await client.query("commit");
    console.log("Database schema applied.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
