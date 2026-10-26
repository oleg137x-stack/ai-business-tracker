#!/usr/bin/env python3
"""
Daily ingestion for the AI Business Tracker and the AI Marketing Tracker.

One run covers both trackers. For each, it uses Claude with the web_search
server tool to find new records, extracts them into that tracker's schema,
de-dupes against what is already stored, writes a one-line digest sentence
and the Russian fields, then rewrites the current ISO week's digest intro.

Run:
    export ANTHROPIC_API_KEY=sk-ant-...
    python3 scripts/ingest.py                        # look back 3 days
    python3 scripts/ingest.py --since 2026-10-01     # backfill from a date
    python3 scripts/ingest.py --tracker marketing    # one tracker only
    python3 scripts/ingest.py --dry-run              # print, don't write

Scheduled daily by .github/workflows/daily-ingest.yml.
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

try:
    import anthropic
except ImportError:
    sys.exit("Missing dependency. Run:  pip install -r requirements.txt")

MODEL = "claude-opus-5-5"
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
TRACKER_START = "2026-10-01"

SECTORS = {
    "Financial": ["Banks", "Payments", "Fintech", "Insurance",
                  "Asset & Wealth Management", "Exchanges & Market Infrastructure"],
    "Retail & Consumer": ["Retail & E-commerce", "Consumer Products", "Food & Beverage",
                          "Restaurants", "Apparel & Luxury"],
    "Health": ["Pharma & Biotech", "Healthcare Providers", "Health Insurers", "Medical Devices"],
    "Technology": ["Big Tech & Cloud", "Software & SaaS", "Semiconductors & Hardware",
                   "IT Services & Consulting"],
    "Telecom & Media": ["Telecom", "Media & Entertainment", "Advertising & Marketing", "Gaming"],
    "Energy & Resources": ["Oil & Gas", "Utilities & Power", "Renewables",
                           "Metals & Mining", "Chemicals"],
    "Industrial": ["Industrial Manufacturing", "Aerospace & Defense", "Automotive",
                   "Construction & Engineering"],
    "Transport": ["Airlines", "Logistics & Delivery", "Rail & Shipping"],
    "Services & Other": ["Professional Services", "Real Estate", "Education",
                         "Agriculture", "Hospitality & Travel"],
}
INDUSTRY_SECTOR = {i: s for s, items in SECTORS.items() for i in items}

REGIONS = ["North America", "Europe", "UK & Ireland", "Asia-Pacific", "MENA", "Latin America"]
BUSINESS_AREAS = ["Customer Service", "Marketing & Sales", "Supply Chain",
                  "Manufacturing & Field Ops", "Engineering & IT", "Finance", "HR",
                  "Legal & Compliance", "R&D", "Risk & Safety", "Product", "Cross-functional"]
RECORD_TYPES = ["Use case", "Investment / programme", "Partnership", "Product launch",
                "Org / leadership"]
AI_TYPES = ["Generative AI", "Agentic AI", "Predictive ML", "NLP", "Computer Vision",
            "Conversational AI", "Robotics", "Other"]
STATUSES = ["Announced", "Pilot", "Deployed", "Scaling", "Investment"]
ENTITY_TYPES = ["Large enterprise", "Tech vendor"]

PROMOTER_TYPES = ["AI lab", "Big tech", "Enterprise brand", "Bank / financial",
                  "Agency / studio", "Startup"]
ACTIVITY_TYPES = ["Model launch", "Feature promo", "Ad campaign", "Brand film / video",
                  "Keynote / event", "Developer conference", "Sponsorship / partnership",
                  "PR & media relations", "Brand & identity", "Creator & influencer",
                  "Pricing & positioning", "Earned-media moment"]
CHANNELS = ["TV & streaming", "Online video", "Social", "Out-of-home", "Print",
            "Owned newsroom / blog", "Live event", "Podcast", "Press briefing",
            "Developer channels", "Multi-channel"]
AUDIENCES = ["Consumer", "Developer", "Enterprise buyer", "Investor", "Policy & public"]

TIERS = ("primary", "news", "secondary")
CONFIDENCE = ("high", "med", "low")


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

def slugify(*parts: str) -> str:
    text = "-".join(str(p) for p in parts if p).lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:90]


def pick(value, allowed, default):
    return value if value in allowed else default


def load_json(path: Path, fallback):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print(f"  ! {path.name} is not valid JSON; treating as empty")
    return fallback


def write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def week_start(iso: str) -> str:
    d = dt.date.fromisoformat(iso)
    return (d - dt.timedelta(days=d.weekday())).isoformat()


def extract_json(text: str, opener: str = "["):
    closer = "]" if opener == "[" else "}"
    fence = re.search(r"```(?:json)?\s*(\%s.*?\%s)\s*```" % (opener, closer), text, re.DOTALL)
    span = fence or re.search(r"(\%s.*\%s)" % (opener, closer), text, re.DOTALL)
    if not span:
        return [] if opener == "[" else {}
    try:
        return json.loads(span.group(1))
    except json.JSONDecodeError:
        return [] if opener == "[" else {}


def call_claude(prompt: str, search: bool = False, max_tokens: int = 16000) -> str:
    """One Claude call, resuming through server-tool pauses when searching."""
    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": prompt}]
    kwargs = {"model": MODEL, "max_tokens": max_tokens}
    if search:
        kwargs["tools"] = [{"type": "web_search_20260209", "name": "web_search", "max_uses": 14}]

    for _ in range(8):
        resp = client.messages.create(messages=messages, **kwargs)
        if resp.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": resp.content})
            continue
        return "".join(b.text for b in resp.content if b.type == "text")
    return ""


# --------------------------------------------------------------------------- #
# prompts
# --------------------------------------------------------------------------- #

def business_prompt(since: str, today: str) -> str:
    return f"""You are a research analyst building a database of real, verifiable uses of AI \
at large companies worldwide, plus the AI-for-business announcements of the major technology \
vendors.

Search the web for news, press releases and official announcements published between {since} \
and {today} about specific named companies deploying, piloting, scaling or investing in AI.

COMPANY UNIVERSE: the Fortune 500, non-US companies of comparable scale (so the tracker is \
genuinely global), and the major global technology vendors whose business-facing AI \
announcements shape what others deploy — Google, Amazon/AWS, Microsoft, Anthropic, OpenAI, \
xAI, Meta, Nvidia, Salesforce, IBM, Oracle, SAP, ServiceNow and peers.

INCLUSION RULES:
- DO include a deployment announced by a VENDOR that names its customer. Create the record \
for the CUSTOMER and put the vendor in "vendor".
- DO include AI programme investments and capital commitments, named partnerships, and \
AI-related leadership or reorganisation moves at a named company.
- DO include a technology vendor's own announcement when it is an AI-for-business product, \
platform or programme that enterprises will buy or deploy.
- DO NOT include consultancy reports, survey findings, market forecasts, or "company is \
exploring AI" stories with no named initiative.
- DO NOT include pure consumer app features with no business deployment angle.
- Prioritise concrete, named, dated initiatives over vague intentions.

Run several distinct searches with different queries. Sweep the most recent days first, then \
broaden. For each genuine record with a working source link, produce one JSON object with \
EXACTLY these fields:

- "company": the specific company or brand name
- "parent_group": parent group if it is a subsidiary or brand, else ""
- "industry": one of {sorted(INDUSTRY_SECTOR)}
- "entity_type": one of {ENTITY_TYPES} ("Tech vendor" only for the vendor's own product/programme announcements)
- "fortune500_rank": integer rank if you are confident of it, else null
- "country": HQ country
- "region": one of {REGIONS} (classify by HQ country; never "Global")
- "business_area": one of {BUSINESS_AREAS}
- "record_type": one of {RECORD_TYPES}
- "ai_type": one of {AI_TYPES}
- "title": short headline, <= 110 chars, no trailing full stop
- "description": 1-3 sentence summary of what was actually done
- "vendor": tech partner or model provider if named, else ""
- "outcome": the reported result, quoted with its unit and scope. If nothing was reported, \
write exactly "Not disclosed". Never estimate, never substitute a vendor projection.
- "metric": a SHORT scannable version of a reported number (e.g. "-18% time-to-cart", \
"$9bn over 3 years", "41% fewer defects"). Empty string if no number was reported.
- "investment_amount": the stated figure as text if this is an investment, else ""
- "status": one of {STATUSES}
- "digest_line": ONE standalone sentence under 160 characters for a social-media digest, \
naming the company, what it did, and the number if there is one. It must read on its own \
without the headline. Example: "Walmart launched an agentic shopping assistant across its \
US app and cut time-to-cart by 18%"
- "event_date": YYYY-MM-DD, the announcement or event date (use the article date if unclear)
- "source_name": publication name, or the company name for a press release
- "source_url": the exact URL you found. PREFER primary sources (company newsroom, investor \
release, vendor press release) over news, and news over aggregators.
- "source_tier": "primary", "news" or "secondary"
- "source_channel": short label, e.g. "newsroom", "investor release", "trade press"
- "confidence": "high" (primary, or news with a named metric), "med" (news, no hard metric), \
"low" (secondary only)

Rules:
- Only records with a real source_url you actually found via search. NEVER invent a URL.
- No duplicates of the same event.
- Nothing dated before {TRACKER_START}.
- Aim for 8-20 high-quality records if they exist.

Return ONLY a JSON array, in a ```json code block. No prose."""


def marketing_prompt(since: str, today: str) -> str:
    return f"""You are a marketing analyst building a database of how AI is introduced, \
positioned and marketed — the craft of the announcement, not the technology behind it.

Search the web for coverage published between {since} and {today} of marketing, \
communications and launch moves around AI.

WHAT COUNTS: how a model launch was staged; how a feature was promoted; ad campaigns and \
brand films; keynotes and developer conferences; press and media relations plays; brand and \
identity work; creator and influencer activity; pricing and positioning moves; and notable \
earned-media moments, including backlash.

WHO: mostly the AI labs and the big technology platforms (OpenAI, Anthropic, Google, \
Microsoft, Meta, xAI, Amazon, Nvidia, Apple), since they produce most of the interesting \
work — but ANY company marketing its own AI belongs here, including an enterprise or a bank \
launching and publicising its own model. Credit the agency or studio where one is named.

WHERE TO LOOK: the advertising and marketing trade press (Adweek, Campaign, Ad Age, The Drum, \
Marketing Brew, Creative Review, Contagious), launch events and keynote recordings, brand \
newsrooms and owned blogs, creative award announcements, and the coverage following a launch.

DO NOT include: a deployment story with no marketing angle; a funding round; a product \
changelog; a pure analyst or survey report.

Run several distinct searches with different queries. For each genuine record with a working \
source link, produce one JSON object with EXACTLY these fields:

- "company": whoever did the marketing
- "parent_group": parent group if applicable, else ""
- "promoter_type": one of {PROMOTER_TYPES}
- "activity_type": one of {ACTIVITY_TYPES}
- "channel": one of {CHANNELS}
- "audience": one of {AUDIENCES}
- "country": country of origin, or "" if genuinely global
- "region": one of {REGIONS + ["Global"]}
- "subject": what is being marketed — the model, product or programme name
- "title": short headline, <= 110 chars, no trailing full stop
- "description": 1-3 sentences on what was actually done
- "angle": the positioning in ONE line — the claim, the message, the register. Be specific \
about the argument being made, not generic. Example: "competence over spectacle: no benchmark \
charts on stage, three unscripted live demos, two of which failed and were left in"
- "craft_note": what is notable in the EXECUTION — casting, music, direction, staging, copy, \
format, media buy. The thing a marketer would want to look at. Empty string if the coverage \
genuinely says nothing about execution.
- "asset_url": direct link to the ad, film, keynote recording or landing page if there is one \
distinct from the source article, else ""
- "spend": reported spend or media weight as text, else ""
- "agency": creative agency or studio if named, else ""
- "outcome": measured RECEPTION — views, earned coverage, sign-ups, sentiment, awards, \
backlash — quoted with its unit. If nothing was reported, write exactly "Not disclosed".
- "metric": SHORT scannable version of a reported number (e.g. "4.1M views in 48h", \
"190 pieces of coverage"). Empty string if none.
- "digest_line": ONE standalone sentence under 160 characters for a social-media digest, \
naming the company, what it did and how it landed. It must read on its own.
- "event_date": YYYY-MM-DD of the launch, airing or event (article date if unclear)
- "source_name", "source_url", "source_tier" ("primary"/"news"/"secondary"), \
"source_channel" (e.g. "trade press", "newsroom", "keynote"), \
"confidence" ("high"/"med"/"low")

Rules:
- Only records with a real source_url you actually found via search. NEVER invent a URL.
- No duplicates of the same event.
- Nothing dated before {TRACKER_START}.
- Aim for 8-20 high-quality records if they exist.

Return ONLY a JSON array, in a ```json code block. No prose."""


# --------------------------------------------------------------------------- #
# normalisation
# --------------------------------------------------------------------------- #

def normalise_business(rec: dict, today: str):
    if not all(rec.get(k) for k in ("company", "title", "source_url")):
        return None

    industry = rec.get("industry")
    if industry not in INDUSTRY_SECTOR:
        return None
    out = {
        "company": str(rec["company"]).strip(),
        "parent_group": rec.get("parent_group") or "",
        "sector": INDUSTRY_SECTOR[industry],
        "industry": industry,
        "entity_type": pick(rec.get("entity_type"), ENTITY_TYPES, "Large enterprise"),
        "fortune500_rank": rec["fortune500_rank"] if isinstance(rec.get("fortune500_rank"), int) else None,
        "country": rec.get("country") or "",
        "region": pick(rec.get("region"), REGIONS, "North America"),
        "business_area": pick(rec.get("business_area"), BUSINESS_AREAS, "Cross-functional"),
        "record_type": pick(rec.get("record_type"), RECORD_TYPES, "Use case"),
        "ai_type": pick(rec.get("ai_type"), AI_TYPES, "Other"),
        "title": str(rec["title"]).strip().rstrip("."),
        "description": rec.get("description") or "",
        "vendor": rec.get("vendor") or "",
        "outcome": rec.get("outcome") or "Not disclosed",
        "metric": rec.get("metric") or "",
        "investment_amount": rec.get("investment_amount") or "",
        "status": pick(rec.get("status"), STATUSES, "Announced"),
        "digest_line": (rec.get("digest_line") or "").strip(),
    }
    return finish(out, rec, today)


def normalise_marketing(rec: dict, today: str):
    if not all(rec.get(k) for k in ("company", "title", "source_url")):
        return None

    out = {
        "company": str(rec["company"]).strip(),
        "parent_group": rec.get("parent_group") or "",
        "promoter_type": pick(rec.get("promoter_type"), PROMOTER_TYPES, "Big tech"),
        "activity_type": pick(rec.get("activity_type"), ACTIVITY_TYPES, "PR & media relations"),
        "channel": pick(rec.get("channel"), CHANNELS, "Owned newsroom / blog"),
        "audience": pick(rec.get("audience"), AUDIENCES, "Consumer"),
        "country": rec.get("country") or "",
        "region": pick(rec.get("region"), REGIONS + ["Global"], "Global"),
        "subject": rec.get("subject") or "",
        "title": str(rec["title"]).strip().rstrip("."),
        "description": rec.get("description") or "",
        "angle": rec.get("angle") or "",
        "craft_note": rec.get("craft_note") or "",
        "asset_url": rec.get("asset_url") or "",
        "spend": rec.get("spend") or "",
        "agency": rec.get("agency") or "",
        "outcome": rec.get("outcome") or "Not disclosed",
        "metric": rec.get("metric") or "",
        "digest_line": (rec.get("digest_line") or "").strip(),
    }
    return finish(out, rec, today)


def finish(out: dict, rec: dict, today: str):
    """Shared tail: date, sourcing, digest fallback, id."""
    date = str(rec.get("event_date", ""))
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        date = today
    if date < TRACKER_START:
        return None
    if date > today:          # a model occasionally reads a future-dated embargo line
        date = today

    out["event_date"] = date
    out["source_name"] = rec.get("source_name") or ""
    out["source_url"] = str(rec["source_url"]).strip()
    out["source_tier"] = pick(rec.get("source_tier"), TIERS, "secondary")
    out["source_channel"] = rec.get("source_channel") or ""
    out["confidence"] = pick(rec.get("confidence"), CONFIDENCE, "low")
    if not out["digest_line"]:
        out["digest_line"] = f"{out['company']}: {out['title']}"
    out["id"] = slugify(out["company"], date, out["title"])
    out["added_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    return out


# --------------------------------------------------------------------------- #
# translation and weekly intro
# --------------------------------------------------------------------------- #

RU_FIELDS = {
    "business": ["title", "description", "outcome", "digest_line"],
    "marketing": ["title", "description", "angle", "outcome", "digest_line"],
}


def translate(records: list, tracker: str) -> int:
    """Fill the *_ru fields for records missing them. Returns how many were done."""
    fields = RU_FIELDS[tracker]
    todo = [r for r in records if not r.get("title_ru")]
    if not todo:
        return 0

    done = 0
    for batch_start in range(0, len(todo), 10):
        batch = todo[batch_start:batch_start + 10]
        payload = [
            {"id": r["id"], **{f: r.get(f, "") for f in fields}}
            for r in batch
        ]
        prompt = (
            "Translate the following records from English into Russian for a business news "
            "feed. Keep company, product and model names in their original Latin spelling. "
            "Keep numbers, units and currency symbols exactly as they are. Translate "
            "naturally, as a Russian business journalist would write it — not word for word. "
            "Keep each translation roughly the same length as the original.\n\n"
            "Return ONLY a JSON array in a ```json block, one object per input record, with "
            'the "id" plus a Russian value for each of these keys: '
            + ", ".join(fields) + ".\n\n"
            "```json\n" + json.dumps(payload, ensure_ascii=False, indent=2) + "\n```"
        )
        result = extract_json(call_claude(prompt, max_tokens=8000), "[")
        by_id = {r.get("id"): r for r in result if isinstance(r, dict)}
        for rec in batch:
            got = by_id.get(rec["id"])
            if not got:
                continue
            for f in fields:
                if got.get(f):
                    rec[f + "_ru"] = got[f]
            if rec.get("title_ru"):
                done += 1
        print(f"  translated {done}/{len(todo)}")
    return done


def weekly_intro(records: list, tracker: str, week: str) -> dict:
    """Write the digest intro for one ISO week. Returns {} when there is too little."""
    end = (dt.date.fromisoformat(week) + dt.timedelta(days=6)).isoformat()
    rows = [r for r in records if week <= r["event_date"] <= end]
    if len(rows) < 3:
        return {}

    facets = ("sector", "industry", "business_area", "status") if tracker == "business" \
        else ("activity_type", "channel", "audience", "promoter_type")
    brief = [
        {"company": r["company"], "title": r["title"], "outcome": r.get("outcome", ""),
         **{f: r.get(f, "") for f in facets}}
        for r in rows
    ]
    subject = ("AI in global business" if tracker == "business"
               else "AI marketing and communications")

    prompt = (
        f"Here are the {len(rows)} records from one week of a tracker covering {subject}.\n\n"
        "```json\n" + json.dumps(brief, ensure_ascii=False, indent=2) + "\n```\n\n"
        "Write a two-to-three sentence introduction for a weekly digest of these records. "
        "Say which areas the week's records clustered in, then what the notable moves point "
        "to. Be specific and count things where counting helps (e.g. 'four of the eleven "
        "announcements...'). Ground every claim in the records above — do not bring in "
        "outside knowledge, do not forecast, do not use marketing language, and do not "
        "open with a throat-clearing phrase like 'This week was a busy one'. Write plainly, "
        "as a well-informed analyst briefing a colleague.\n\n"
        'Return ONLY a JSON object in a ```json block with two keys: "intro" (English) and '
        '"intro_ru" (the same text in natural Russian, with company and product names left '
        "in Latin script)."
    )
    got = extract_json(call_claude(prompt, max_tokens=4000), "{")
    if isinstance(got, dict) and got.get("intro"):
        return {"intro": got["intro"].strip(), "intro_ru": (got.get("intro_ru") or "").strip(),
                "records": len(rows),
                "written_at": dt.datetime.now(dt.timezone.utc).isoformat()}
    return {}


# --------------------------------------------------------------------------- #
# per-tracker run
# --------------------------------------------------------------------------- #

TRACKER_CONFIG = {
    "business": {"data": "business.json", "weekly": "weekly-business.json",
                 "prompt": business_prompt, "normalise": normalise_business},
    "marketing": {"data": "marketing.json", "weekly": "weekly-marketing.json",
                  "prompt": marketing_prompt, "normalise": normalise_marketing},
}


def run_tracker(tracker: str, since: str, today: str, dry_run: bool,
                skip_search: bool = False) -> dict:
    conf = TRACKER_CONFIG[tracker]
    data_file = DATA / conf["data"]
    weekly_file = DATA / conf["weekly"]

    existing = load_json(data_file, [])
    if not isinstance(existing, list):
        existing = []
    seen_ids = {r.get("id") for r in existing}
    seen_urls = {str(r.get("source_url", "")).rstrip("/") for r in existing}

    added = []
    if not skip_search:
        print(f"[{tracker}] searching {since} -> {today} …")
        found = extract_json(call_claude(conf["prompt"](since, today), search=True), "[")
        print(f"[{tracker}] model returned {len(found)} candidates")

        for raw in found:
            if not isinstance(raw, dict):
                continue
            rec = conf["normalise"](raw, today)
            if not rec:
                continue
            url = rec["source_url"].rstrip("/")
            if rec["id"] in seen_ids or url in seen_urls:
                continue
            seen_ids.add(rec["id"])
            seen_urls.add(url)
            added.append(rec)

        print(f"[{tracker}] {len(added)} new after dedup")
        for r in added:
            print(f"  + [{r['event_date']}] {r['company']}: {r['title']}")

    combined = existing + added
    combined.sort(key=lambda r: (r.get("event_date", ""), r.get("company", "")), reverse=True)

    translated = 0
    if combined and not dry_run:
        translated = translate(combined, tracker)

    weeks = load_json(weekly_file, {})
    if not isinstance(weeks, dict):
        weeks = {}
    current = week_start(today)
    intro_written = False
    if combined and not dry_run:
        intro = weekly_intro(combined, tracker, current)
        if intro:
            weeks[current] = intro
            intro_written = True
        # backfill any closed week that never got one
        past = sorted({week_start(r["event_date"]) for r in combined} - {current} - set(weeks))
        for w in past:
            intro = weekly_intro(combined, tracker, w)
            if intro:
                weeks[w] = intro
                print(f"[{tracker}] backfilled intro for week of {w}")

    if dry_run:
        print(f"[{tracker}] --dry-run: not writing")
    else:
        write_json(data_file, combined)
        write_json(weekly_file, weeks)
        print(f"[{tracker}] wrote {len(combined)} records, {len(weeks)} weekly intros")

    return {"added": len(added), "total": len(combined), "translated": translated,
            "weekly_intro_for": current if intro_written else None}


# --------------------------------------------------------------------------- #

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", help="YYYY-MM-DD lower bound (default: 3 days ago)")
    ap.add_argument("--tracker", choices=sorted(TRACKER_CONFIG), help="only this tracker")
    ap.add_argument("--no-search", action="store_true",
                    help="skip the search pass; only translate and write weekly intros")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    today = dt.date.today()
    today_s = today.isoformat()
    since = args.since or max(TRACKER_START, (today - dt.timedelta(days=3)).isoformat())

    if not os.getenv("ANTHROPIC_API_KEY"):
        # On the nightly cron, exit 0: a missing secret should not send a failure
        # email every morning. On a run someone triggered by hand, fail loudly —
        # silently doing nothing is the worst possible answer to "go and fetch".
        msg = ("ANTHROPIC_API_KEY is not set. Add it as an Actions secret: "
               "Settings -> Secrets and variables -> Actions -> New repository secret.")
        if os.getenv("GITHUB_EVENT_NAME") == "workflow_dispatch":
            sys.exit(msg)
        print(msg + " Skipping ingestion (no changes made).")
        return

    trackers = [args.tracker] if args.tracker else sorted(TRACKER_CONFIG)
    status = load_json(DATA / "ingest-status.json", {})
    if not isinstance(status, dict):
        status = {}
    status.setdefault("trackers", {})

    for tracker in trackers:
        try:
            status["trackers"][tracker] = run_tracker(
                tracker, since, today_s, args.dry_run, args.no_search)
            status["trackers"][tracker]["error"] = None
        except Exception as exc:                     # keep the other tracker running
            print(f"[{tracker}] FAILED: {exc}")
            status["trackers"].setdefault(tracker, {})["error"] = str(exc)

    status["last_run"] = dt.datetime.now(dt.timezone.utc).isoformat()
    status["since"] = since
    if not args.dry_run:
        write_json(DATA / "ingest-status.json", status)


if __name__ == "__main__":
    main()
