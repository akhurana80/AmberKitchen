const http = require("http");
const https = require("https");

const target = process.env.LOAD_TEST_URL || "http://localhost:8080/health";
const requests = Number(process.env.LOAD_TEST_REQUESTS || 100);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 10);
const client = target.startsWith("https") ? https : http;

let completed = 0;
let failed = 0;
let inFlight = 0;
const started = Date.now();

function runOne() {
  inFlight += 1;
  const req = client.get(target, res => {
    if (res.statusCode && res.statusCode >= 500) {
      failed += 1;
    }
    res.resume();
    res.on("end", done);
  });
  req.on("error", () => {
    failed += 1;
    done();
  });
}

function done() {
  completed += 1;
  inFlight -= 1;
  pump();
}

function pump() {
  while (inFlight < concurrency && completed + inFlight < requests) {
    runOne();
  }
  if (completed >= requests) {
    const durationSec = (Date.now() - started) / 1000;
    console.log(JSON.stringify({
      target,
      requests,
      failed,
      durationSec,
      requestsPerSecond: Number((requests / durationSec).toFixed(2))
    }, null, 2));
    process.exit(failed > 0 ? 1 : 0);
  }
}

pump();
