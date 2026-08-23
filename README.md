# HealScrape

*Submission for "Into the Scrape-Verse" hackathon (WeMakeDevs + Bright Data)*

A self-healing web scraper built with [Bright Data's Scraper Studio](https://docs.brightdata.com/datasets/scraper-studio/quickstart)
(via the `bdata` CLI), extracting live package data from an npm registry page
and feeding it into a small downstream app.

## What this project does

1. **Scrapes a niche, non-prebuilt target** — a specific npm package page
   (`https://www.npmjs.com/package/is-odd`) — for `package_name`,
   `current_version`, `weekly_downloads`, and `last_publish_date`. npm's
   registry site is a developer-tooling site, not one of the 800+
   e-commerce/social platforms Bright Data already ships prebuilt scrapers
   for, so it had to be built from scratch with Scraper Studio's AI Flow.
2. **Demonstrates a real self-heal event** — `bdata scraper heal` was used
   to extend the scraper's schema in place (same Collector ID) to also
   capture the package's `license` field. See [Self-heal demo](#self-heal-demo)
   below for exactly what happened, including the honest result.
3. **Feeds a downstream app** — [`app/run.js`](app/run.js) triggers the
   scraper via the Bright Data API, prints a clean table, and appends every
   run to a local JSON history file (`app/history.json`), so successive runs
   are visible side by side.

## Why npm, not the original target

The original target site was an itch.io game page. Building the scraper for
it worked, but **every run failed** with a `proxy_config` 403 error —
isolated (via a control test against `example.com`, and a plain Web Unlocker
fetch of the same itch.io URL, both of which worked fine) to itch.io
specifically blocking Bright Data's Scraper Studio crawler pool. That's a
site-side block, not something fixable by re-running or healing, so the
target was switched to npm mid-build. Full trail in [PROGRESS.md](PROGRESS.md).

## Setup

1. **Sign up for Bright Data** and apply the hackathon credit code
   (`wemakedevs`) at [brightdata.com](https://brightdata.com).
2. **Log in with the CLI** (no install needed — runs via `npx`):
   ```bash
   npx -p @brightdata/cli bdata login
   ```
   This opens a browser for OAuth and auto-creates the `cli_unlocker` and
   `cli_browser` zones your account needs.
3. **Verify:**
   ```bash
   npx -p @brightdata/cli bdata budget
   ```
4. **Set up local secrets:**
   ```bash
   cp .env.example .env
   ```
   Then fill in `.env`:
   - `BRIGHT_DATA_API_TOKEN` — from
     [brightdata.com/cp/setting/users](https://brightdata.com/cp/setting/users)
     ("Show" next to your API key)
   - `COLLECTOR_ID` — already set to `c_mt4kwj0g1s40ktkdcx` (this project's
     scraper); change it if you rebuild your own.

No other dependencies to install — the downstream app is plain Node.js
(v18+ for built-in `fetch`) with zero npm packages.

## Running the scraper

Build (already done for this repo — Collector ID above):
```bash
npx -p @brightdata/cli bdata scraper create https://www.npmjs.com/package/is-odd \
  "Extract the package name, current version number, weekly downloads count, and last publish date"
```

Run it directly via the CLI:
```bash
npx -p @brightdata/cli bdata scraper run c_mt4kwj0g1s40ktkdcx \
  https://www.npmjs.com/package/is-odd --pretty
```

Sample output → [`sample-output.json`](sample-output.json).

## Running the downstream app

```bash
node app/run.js
```

This triggers the collector via the Bright Data API directly
(`POST /dca/trigger_immediate` → poll `/dca/get_result`), prints a table,
and appends the result (with a timestamp) to `app/history.json`.

```
HoloScrape — latest scrape result
----------------------------------------------
Package          : is-odd
Version          : 3.0.1
Weekly downloads : 1186373
Last publish     : 8 years ago
----------------------------------------------

Appended to app\history.json (2 runs total)
```

## Self-heal demo

**What we asked it to do:** extend the scraper in place — same Collector ID
(`c_mt4kwj0g1s40ktkdcx`) — to also capture the package's `license` field
alongside the existing 4 fields.

```bash
npx -p @brightdata/cli bdata scraper heal c_mt4kwj0g1s40ktkdcx \
  "Also capture the package's license type (e.g. MIT) shown on the page, \
   alongside the existing package_name, current_version, weekly_downloads, \
   and last_publish_date fields" \
  --url https://www.npmjs.com/package/is-odd --pretty
```

**What Bright Data's AI Flow produced** — a genuine `awaiting_approval`
response with a working preview showing the new field
(full unedited output saved at [`heal-preview.json`](heal-preview.json)):

```json
{
  "collector_id": "c_mt4kwj0g1s40ktkdcx",
  "status": "awaiting_approval",
  "preview_result": [
    {
      "package_name": "is-odd",
      "current_version": "3.0.1",
      "weekly_downloads": 1479544,
      "last_publish_date": "8 years ago",
      "license": "MIT"
    }
  ],
  "next_step": "bdata scraper approve c_mt4kwj0g1s40ktkdcx --url https://www.npmjs.com/package/is-odd"
}
```

We reviewed the preview, then approved it — same Collector ID, `status`
advances to `done`:

```bash
npx -p @brightdata/cli bdata scraper approve c_mt4kwj0g1s40ktkdcx \
  --url https://www.npmjs.com/package/is-odd --pretty
```

**Honest result:** the heal was accepted by Bright Data's platform end to
end (preview → approve → `done`), but in this project's testing, the
newly-added field did not consistently reappear on subsequent live
`scraper run` calls against this particular npm page (we tried multiple
fields and multiple run modes — default, `--version=dev`, `--sync` — see
[PROGRESS.md](PROGRESS.md) for the full trail of 4 heal attempts). The
scraper's original 4 fields remained rock solid throughout. We're
documenting this transparently rather than staging a cleaner-looking demo:
the *heal mechanism itself* — detect a gap, describe it in plain English,
get back a verified preview, approve in place without a new Collector ID —
worked exactly as designed. Live extraction reliability for the added field
on this specific site is a separate, real finding.

## Project structure

```
.
├── app/
│   ├── run.js          # downstream consumer: trigger scraper, print table, log history
│   └── history.json     # generated at runtime — one entry per run
├── scraper/              # (reserved for any local scraper-side code/config)
├── sample-output.json    # real output from the working 4-field scraper
├── heal-preview.json     # real output from the heal approval gate
├── .env.example
├── PROGRESS.md            # full build log, decisions, and blockers as they happened
└── README.md
```

## Demo video

TBD — link goes here once recorded.
