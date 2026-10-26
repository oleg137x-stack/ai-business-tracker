# AI Business Tracker + AI Marketing Tracker

Two trackers in one static site, refreshed daily.

- **AI Business Tracker** — what large companies did with AI and what it produced: deployments, pilots, scaled rollouts, programme investments, partnerships.
- **AI Marketing Tracker** — how AI is introduced, positioned and marketed: model launches and how they were staged, campaigns and films, keynotes, PR, brand work, pricing and positioning.

Live: **https://oleg137x-stack.github.io/ai-business-tracker/**

Data starts 1 October 2026. No charts, no statistics — filters, a summarised feed with sources and measured outcomes, and a weekly digest built to paste straight into a post.

## How it works

A static page reads plain JSON. A scheduled GitHub Actions job rewrites that JSON once a day.

```
index.html                     the page — both trackers render through this markup
sources.html                   data sources and methodology
assets/app.js                  all behaviour; TRACKERS config declares each tracker
assets/styles.css              signage typography, the two theme variable sets
assets/fonts/                  IBM Plex Mono + Sans, self-hosted (latin + cyrillic)
data/business.json             business records
data/marketing.json            marketing records
data/weekly-*.json             per-week digest intros, English and Russian
data/schema-*.json             the record schemas
data/ingest-status.json        when the job last ran and what it did
scripts/ingest.py              the daily ingestion
.github/workflows/             the cron
```

There is no build step and no framework. Open `index.html` through any static server and it runs.

### Adding a third tracker

Add an entry to `TRACKERS` in `assets/app.js` (title, data files, facet definitions), a button to the selector in `index.html`, and a config entry plus a prompt and a normaliser in `scripts/ingest.py`. Filtering, rendering, CSV, the share preview and the digest are written once and read the config.

## Running it locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Running the ingestion

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...

python scripts/ingest.py                        # both trackers, last 3 days
python scripts/ingest.py --since 2026-10-01     # backfill from a date
python scripts/ingest.py --tracker marketing    # one tracker
python scripts/ingest.py --no-search            # only translate + weekly intros
python scripts/ingest.py --dry-run              # print, write nothing
```

Without `ANTHROPIC_API_KEY` the script exits 0 and changes nothing, so a missing secret does not fail the workflow every morning.

The job runs at 06:15 UTC daily and can be triggered by hand from the Actions tab, optionally with a `since` date or a single `tracker`. It needs one repository secret:

```bash
gh secret set ANTHROPIC_API_KEY --repo oleg137x-stack/ai-business-tracker
```

## What the data promises

Every record is one dated, sourced event. Outcomes quote only what was actually reported — where nothing was published the field reads "Not disclosed" rather than an estimate, and the **Measured only** filter isolates the records carrying a real number.

Curation is AI-assisted, which is what makes daily coverage of this many companies possible and also what makes the failure modes worth knowing: a summary can compress away a qualifier, a classification can land in the wrong industry, a date can be the article's rather than the event's. Treat every entry as a pointer to its source. [Methodology](sources.html) covers this in full.
