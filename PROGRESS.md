# HealScrape — Progress Tracker

## Status: in-progress
Last updated: 2026-08-23 (deadline day)

## Target site
- **Site: https://www.npmjs.com/package/is-odd** (npm package page) — CONFIRMED WORKING with Scraper Studio crawler.
- Why it qualifies (not in Bright Data's 800+ prebuilt library): npm's registry site is a developer-tooling site, not a major e-commerce/social platform covered by BD's prebuilt scrapers (Amazon, LinkedIn, TikTok, etc). Public, no login wall, no personal data.
- Fields being scraped: package_name, current_version, weekly_downloads, last_publish_date
- "Changes over time" story: package authors publish new versions periodically (version bump + last_publish_date change), and weekly_downloads fluctuates constantly — both are natural, low-effort things to demo as "site changed, scraper re-verified."
- (Note: itch.io was the original pick but was abandoned — see Decisions log and Blockers/Resolved below.)

## Checklist
- [x] Target site chosen and validated as "long tail" (not prebuilt)
- [x] Bright Data account set up, $50 credit applied (code: wemakedevs)
- [x] `bdata login` completed
- [x] `bdata scraper create <url> "<description>"` run, Collector ID obtained: `c_mt4kwj0g1s40ktkdcx` (npm is-odd page; supersedes abandoned itch.io collector `c_mt4k6tl3okktfmbut`)
- [x] First successful `bdata scraper run` — clean JSON confirmed
- [x] Downstream app/script built (consumes the JSON)
- [x] Self-heal scenario prepared (what will "break" and how)
- [x] `bdata scraper heal` run successfully, same Collector ID, output verified (see caveat in Decisions log / README)
- [x] README written with clear setup/run instructions
- [x] .env and API tokens confirmed NOT committed to repo
- [ ] Demo video recorded (create → run → break → heal → re-run)
- [x] Repo pushed (https://github.com/Ragav-K/HealScrape)
- [ ] Submission form filled out

## Decisions log
- 2026-08-22: Scaffolded repo structure (README.md, .env.example, .gitignore, scraper/, app/, PROGRESS.md) before any code, per project instructions.
- 2026-08-22: Downstream app ([app/run.js](app/run.js)) built as a Node.js CLI script (Node 22, no external deps — uses built-in `fetch`). Calls `POST /dca/trigger_immediate` + polls `/dca/get_result` directly against the Bright Data API (not shelling out to `bdata`), per user's choice of "CLI table + local history file". Prints a formatted table and appends each run (with timestamp) to `app/history.json`, so pre-heal and post-heal runs are visible side by side for the demo.
- 2026-08-22: Chose itch.io game page (HoloCure, kay-yu.itch.io/holocure) as target site — niche indie storefront, unlikely to be in BD's prebuilt library. Fields: title, price, rating, last-updated date. Confirmed with user via AskUserQuestion (chose "itch.io game page" over OSS changelog / other option).
- 2026-08-22: `npx -p @brightdata/cli bdata` confirmed working locally (v0.3.5). `bdata login` requires an interactive browser OAuth flow that cannot run in this non-interactive session — user must run it themselves.

## Blockers / open questions (resolved — pragmatic call made)
- **Extra 5th field (added via heal) never reliably shows up in live runs, regardless of which field or which endpoint.** Full investigation:
  - Heal #1 (2026-08-22): added `license`. Approved (`status: done`). Preview showed it correctly. 5 of 6 live re-runs afterward: missing.
  - Heal #2 (2026-08-23): re-healed to make the license selector more robust. **Failed** (`status: "failed"`) after a long multi-round fix loop. Non-destructive — collector reverted to post-heal-#1 state automatically.
  - Heal #3 (2026-08-23): dropped `license`, added `install_command` instead (a field expected to be server-rendered, not async). Approved (`status: done`). Preview showed it correctly (`"npm i  is-odd"`). **Every subsequent live run — default, `--version=dev`, and `--sync` — came back without it.** 0 for 4.
  - **Conclusion**: this isn't a selector-reliability problem (different fields, same symptom) or an endpoint-caching problem (tried 3 different run paths, same symptom). It looks like a platform-level gap between what `scraper approve`'s preview executes and what `scraper run` executes for this collector — outside what's fixable by re-healing.
  - Heal #4 (2026-08-23): tried a different angle — reformat the already-reliable `last_publish_date` field (relative → ISO date) instead of adding a new selector, on the theory that touching a known-good field would be safer. **Timed out** after 600s (`status: "poll_failed"`). Non-destructive — collector unchanged.
  - **FINAL DECISION (2026-08-23, deadline day)**: after 4 heal attempts (2 approved-but-not-live, 1 failed, 1 timed out), stopped chasing this. Shipping the reliable 4-field scraper (`package_name`, `current_version`, `weekly_downloads`, `last_publish_date`) as the working baseline — reconfirmed stable with a final run. For the self-heal demonstration, using **heal #1's approval evidence** (real `bdata scraper heal` call → real `preview_result` showing the diff from 4→5 fields with `license: "MIT"` → real `bdata scraper approve` → `status: done`, same Collector ID `c_mt4kwj0g1s40ktkdcx` throughout) — this is genuine, unedited Bright Data API output, not fabricated. The README and demo video will be transparent that the live 5th-field extraction is flaky on this particular site/collector combination post-heal, which is itself an honest, real finding worth documenting rather than hiding.

## Blockers / open questions (resolved)
- **`bdata scraper run c_mt4k6tl3okktfmbut ...` fails every time** with:
  `"error": "Crawler error: tunneling socket could not be established, statusCode=403", "error_code": "proxy_config"`
  - Tried: default async run, `--sync` mode, multiple retries over ~5 min. Same error every time — not transient.
  - Isolated: plain `bdata scrape <url>` (Web Unlocker API) works fine and returns the page HTML/markdown. So the account, API key, and `cli_unlocker` zone are all fine — the failure is specific to the Scraper Studio/DCA crawler's own proxy config for this collector.
  - Zones present: `cli_unlocker` (unblocker), `cli_browser` (browser_api) — both auto-created at login and confirmed present via `bdata zones`.
  - Suspect this is an account-level Scraper Studio/DCA activation issue (new account) rather than something fixable by retrying or re-creating the scraper. Needs a human to check the collector in the dashboard (`https://brightdata.com/cp/scrapers/c_mt4k6tl3okktfmbut`) or contact Bright Data support.
  - **Isolated 2026-08-22**: created a second test scraper (`c_mt4ko3531p87ztvnmn`) against `https://example.com` — ran cleanly, clean JSON returned. Re-ran the itch.io scraper immediately after — same `proxy_config` 403 every time. Conclusion: this is **itch.io blocking Bright Data's Scraper Studio (DCA) crawler IP pool specifically** (the separate Web Unlocker pool is not blocked — `bdata scrape` on the same itch.io URL works fine). Not an account-wide or transient issue. Not fixable via `scraper heal` (heal fixes broken selectors/extraction logic, not upstream network blocks).
  - **RESOLVED 2026-08-22**: user approved switching sites. Tested `https://example.com` (worked, isolating the problem to itch.io) then tried `https://www.npmjs.com/package/is-odd` as a real candidate — created scraper `c_mt4kwj0g1s40ktkdcx`, ran it, got clean JSON with no proxy error on first try. Switched target site to npm (see Target site section above). itch.io collector `c_mt4k6tl3okktfmbut` and example.com test collector `c_mt4ko3531p87ztvnmn` are abandoned/orphaned in the BD dashboard — harmless, can be deleted later via the web UI if desired.

## Resolved
- Bright Data account signed up, $50 credit (code `wemakedevs`) confirmed applied — balance shows $50.00 via `bdata budget`.
- `bdata login` completed successfully by user (OAuth browser flow) on second attempt (first attempt's local callback server was killed by a tool timeout before the user could finish authorizing).

## Session log
- 2026-08-23: Wrote real README.md (setup, run instructions, honest self-heal writeup, project structure). Initialized git, added `.claude/` to .gitignore (wasn't meant for the public repo), committed everything (secrets excluded — verified via `git status` before commit), added remote `https://github.com/Ragav-K/HealScrape.git`, pushed to `main`. Repo is live. Remaining: demo video, then fill out the submission form (https://forms.gle/iQf2SjHQViSJaRAv7) before the Aug 23 deadline.
- 2026-08-22: Started project. Scaffolded repo skeleton (README, .env.example, .gitignore, scraper/, app/, PROGRESS.md). Verified `bdata` CLI runs via npx. Chose target site (itch.io HoloCure page) with user confirmation. Blocked on user completing Bright Data signup + `bdata login` (both require actions outside this session).
- 2026-08-22: User completed signup, $50 credit, and `bdata login`. Created itch.io scraper (`c_mt4k6tl3okktfmbut`) but every `scraper run` failed with a `proxy_config` 403 (crawler tunneling error). Isolated the cause: itch.io blocks Bright Data's Scraper Studio (DCA) crawler pool specifically (Web Unlocker still worked fine on the same URL; a control test on example.com worked fine). Got user approval to switch target sites. Tested and confirmed `https://www.npmjs.com/package/is-odd` works cleanly — created `c_mt4kwj0g1s40ktkdcx`, ran it, got clean 4-field JSON on first try. Saved [sample-output.json](sample-output.json). Target site is now locked to npm.
- 2026-08-22: Built downstream app ([app/run.js](app/run.js)) per user's choice ("CLI table + local history file"). User set up `.env` themselves (I never handled the raw token); two rounds of back-and-forth to get `COLLECTOR_ID` correct (user pasted a wrong UUID-format value, I corrected it to `c_mt4kwj0g1s40ktkdcx` since that's not secret). Ran `node app/run.js` successfully — clean table output, appended to `app/history.json`. Confirmed `.env` is gitignored and no git repo exists yet, so no secrets committed. Next: prepare and demonstrate the self-heal scenario (decide what "breaks" — likely ask `bdata scraper heal` to add a new field or point at a changed selector), run `bdata scraper heal`, verify same Collector ID still works post-heal.
