const assert = require("assert");

async function main() {
  const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${baseUrl}/health`);
  assert(response.ok, `Expected /health to return 2xx, got ${response.status}`);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, "amberkitchen-backend");
  console.log(`Smoke test passed for ${baseUrl}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
