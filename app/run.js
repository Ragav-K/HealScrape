#!/usr/bin/env node
/**
 * HealScrape downstream app.
 *
 * Triggers the Bright Data Scraper Studio collector for the npm "is-odd"
 * package page, prints a clean table of the result, and appends it to a
 * local JSON history file so successive runs (including the pre/post
 * self-heal runs) are visible side by side.
 *
 * Usage:
 *   node app/run.js
 *
 * Requires a .env file at the repo root (copy .env.example -> .env) with:
 *   BRIGHT_DATA_API_TOKEN=...
 *   COLLECTOR_ID=c_xxxxxxxxxxxx
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const HISTORY_PATH = path.join(__dirname, "history.json");
const TARGET_URL = "https://www.npmjs.com/package/is-odd";
const API_BASE = "https://api.brightdata.com";
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 100;

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(
      `Missing .env file at ${ENV_PATH}\n` +
        "Copy .env.example to .env and fill in BRIGHT_DATA_API_TOKEN and COLLECTOR_ID."
    );
    process.exit(1);
  }
  const lines = fs.readFileSync(ENV_PATH, "utf8").split("\n");
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

async function triggerScrape(apiToken, collectorId, url) {
  const res = await fetch(`${API_BASE}/dca/trigger_immediate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ collector: collectorId, url }),
  });
  if (!res.ok) {
    throw new Error(`Trigger failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function pollResult(apiToken, responseId) {
  for (let i = 0; i < MAX_POLLS; i++) {
    const res = await fetch(
      `${API_BASE}/dca/get_result?response_id=${encodeURIComponent(responseId)}`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    if (res.status === 200) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Timed out waiting for scrape result.");
}

function printTable(row) {
  const fields = [
    ["Package", row.package_name],
    ["Version", row.current_version],
    ["Weekly downloads", row.weekly_downloads],
    ["Last publish", row.last_publish_date],
  ];
  const width = Math.max(...fields.map(([k]) => k.length));
  console.log("\nHoloScrape — latest scrape result");
  console.log("-".repeat(width + 30));
  for (const [k, v] of fields) {
    console.log(`${k.padEnd(width)} : ${v}`);
  }
  console.log("-".repeat(width + 30));
}

function appendHistory(row) {
  let history = [];
  if (fs.existsSync(HISTORY_PATH)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
    } catch {
      history = [];
    }
  }
  history.push({ scraped_at: new Date().toISOString(), ...row });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  console.log(`\nAppended to ${path.relative(ROOT, HISTORY_PATH)} (${history.length} runs total)`);
}

async function main() {
  const env = loadEnv();
  const apiToken = env.BRIGHT_DATA_API_TOKEN;
  const collectorId = env.COLLECTOR_ID;
  if (!apiToken || apiToken.includes("your_bright_data")) {
    console.error("BRIGHT_DATA_API_TOKEN is not set in .env");
    process.exit(1);
  }
  if (!collectorId || collectorId.includes("xxxx")) {
    console.error("COLLECTOR_ID is not set in .env");
    process.exit(1);
  }

  console.log(`Triggering scraper ${collectorId} on ${TARGET_URL} ...`);
  const trigger = await triggerScrape(apiToken, collectorId, TARGET_URL);
  const responseId = trigger.response_id || trigger.responseId;
  if (!responseId) {
    // Some collector configs return the result inline instead of an id.
    if (Array.isArray(trigger)) {
      const row = trigger[0];
      printTable(row);
      appendHistory(row);
      return;
    }
    throw new Error(`Unexpected trigger response: ${JSON.stringify(trigger)}`);
  }

  console.log(`Polling for result_id ${responseId} ...`);
  const result = await pollResult(apiToken, responseId);
  const row = result[0];
  if (row.error) {
    console.error(`Scrape returned an error: ${row.error} (${row.error_code || "unknown"})`);
    process.exit(1);
  }
  printTable(row);
  appendHistory(row);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
