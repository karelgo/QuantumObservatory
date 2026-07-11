# The Quantum Observatory — founding brief & agent prompt

*A sister project to QuantumVerse: a daily-updated, categorized overview of everything happening in the quantum space.*

**How to use this file:** create a fresh repo (suggested name: `quantum-observatory`), copy this file into it as `BRIEF.md`, open Claude Code there, and say: *"Read BRIEF.md and build Phase 0."* Everything below is written to be self-contained — the agent in the new repo needs nothing from this repo except what's inlined here.

---

## Name

**Recommended: The Quantum Observatory** (repo `quantum-observatory`). QuantumVerse already plans a *Drift Observatory* — a weather map of hardware calibration. This is the same instrument pointed at the whole field: one observatory watches the machines, the other watches the ecosystem. The family naming does the linking for you.

Alternatives, if you want something with more edge:

| Name | Why | Caveat |
|---|---|---|
| **The Daily Collapse** | Best pun available: each daily crawl is a measurement that collapses the day's superposition of news into one definite digest. That's the tagline for free. | Slightly morbid out of context |
| **QuantumPulse** | Clear, safe, "the pulse of the verse." Works well since the machine-readable feed is `pulse.json` regardless of name. | Generic |
| **Superposition** | Great masthead word for an editorial-styled digest | Widely used |
| **EigenTimes** | Newspaper pun physicists will love | Niche |
| **Qurrent** | quantum + current (news currents) | Was a Dutch energy brand — confusing for NL readers |

Avoid names colliding with existing outlets: *The Quantum Insider*, *Quantum Computing Report*, *Quantum Zeitgeist*, *Inside Quantum Technology* all exist.

The rest of this brief uses "the Observatory"; substitute whichever name you pick.

---

# Agent prompt (self-contained from here down)

## Mission

Build **The Quantum Observatory**: a website that gives one person a complete, categorized overview of what happened in quantum computing — updated by an automated daily crawl. It is a *reading instrument*, not a content farm: every item is a headline, a one-to-two-sentence original summary, a category, and a link to the source. Nobody's article text is republished.

It is a sister project to **QuantumVerse** (github.com/karelgo/QuantumVerse; locally at `~/Documents/programming/sandbox/QuantumVerse` — read its `README.md`, `FRONTEND-PLAN.md`, and `docs/index.html` if available, but do not depend on them). QuantumVerse is the home for quantum *artifacts* — circuits, results, verification. The Observatory is the home for quantum *events* — what the field did today. Same visual identity, complementary jobs.

## Categories

Eight categories. Every item gets exactly one primary category (a secondary tag is allowed):

1. **Hardware & QPUs** — new chips, qubit-count/fidelity milestones, error-correction demos, roadmaps
2. **Research & Papers** — notable arXiv quant-ph results, journal publications, breakthroughs
3. **Software & Tools** — SDK/compiler/simulator releases (Qiskit, Cirq, PennyLane, CUDA-Q…), new dev tools
4. **Industry & Funding** — startup rounds, M&A, partnerships, earnings, new companies
5. **Government & Policy** — national programs, export controls, defense initiatives, standards bodies
6. **Post-Quantum Security** — PQC migration, NIST standards, quantum-safe crypto adoption
7. **People & Community** — appointments, prizes, notable moves
8. **Events** — conferences, CFPs, hackathons, upcoming deadlines

## Relationship to QuantumVerse (the linkage contract)

1. **Shared identity.** Use QuantumVerse's exact design tokens (inlined below): editorial serif headlines (Fraunces), one brass accent, ink/muted/line neutrals, light + dark from commit one. The Observatory should look like QuantumVerse's newsroom.
2. **Cross-branding.** Footer and about page: *"A QuantumVerse sister project"* linking to the QuantumVerse pitch site (its GitHub Pages URL). QuantumVerse will link back later.
3. **Machine-readable feed.** Publish `pulse.json` (latest ~50 items, stable schema below) and `feed.xml` (RSS). `pulse.json` is the API contract that lets QuantumVerse render a "Field Pulse" widget on its home page later — treat its schema as public and versioned.
4. **Deep-link conventions.** Hardware items may carry an optional `qv_device` slug and paper items an optional `qv_artifact` slug — empty for now, reserved so items can later point into QuantumVerse's Device Registry (`/devices/{id}`) and artifact pages.

### Design tokens (copy verbatim)

```css
:root { /* light */
  --bg:#F4F5F8; --surface:#FFFFFF; --ink:#161B2C; --muted:#59617A;
  --line:#D9DCE6; --accent:#8F6400; --accent-fill:#B07C0E; --good:#1D7A4A;
  --wire:#9AA1B6; --code-bg:#10142A; --code-ink:#D5DAEC; --code-dim:#7C86A8;
  --card-shadow:0 1px 2px rgba(22,27,44,.05), 0 8px 28px rgba(22,27,44,.07);
  --serif:'Fraunces','Iowan Old Style',Georgia,serif;
  --sans:system-ui,'Segoe UI','Helvetica Neue',sans-serif;
  --mono:ui-monospace,'Cascadia Code','SF Mono',Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){ :root {
  --bg:#0B0E1A; --surface:#121629; --ink:#E8EAF3; --muted:#99A2BC;
  --line:#242B45; --accent:#E0AC45; --accent-fill:#C99835; --good:#4BC98A;
  --wire:#4C5677; --code-bg:#0E1226; --card-shadow:none;
}}
```

Design rules inherited from the family: content is the interface (chrome under ~10% of viewport); brass marks links and nothing else; every page server-renders completely and is readable without JavaScript; the URL is the state; no component library, no CSS framework, no Tailwind — one disciplined global stylesheet; four type sizes only (display serif, body, small, mono).

## Architecture

**Data-as-commits, static site.** No database, no server state:

```
sources.yaml                      # the source registry (the editorial heart)
crawler/                          # TypeScript, run by CI — fetch → normalize → dedupe → classify → rank → write
data/items/YYYY-MM-DD.json        # one file per day, append-only, committed by CI
data/index.json                   # rolling index (last 90 days of item metadata)
web/                              # Next.js (App Router, TypeScript, static export)
.github/workflows/crawl.yml       # daily cron
```

### The daily crawl (GitHub Actions cron, ~06:00 UTC)

1. **Fetch** — read `sources.yaml`; pull RSS/Atom feeds, the arXiv API (`cat:quant-ph`, last 24h, sorted by date), and GitHub release feeds. Respect robots.txt; set a honest User-Agent; per-source timeout and failure isolation (one dead feed never kills the run).
2. **Normalize** — every raw entry becomes `{title, url, source_id, published_at}`. Canonicalize URLs (strip tracking params).
3. **Dedupe** — drop items whose canonical URL is already in the last 14 days of `data/`; near-dup titles (same story from multiple outlets) cluster into one item with `also_at[]` links.
4. **Classify & summarize** — one Claude API call per batch of new items (see below): assign the primary category, write a one-to-two-sentence factual summary *in our own words*, assign a significance score 1–5, flag items that likely reference a paper/device (for the `qv_*` slots).
5. **Rank & write** — write `data/items/YYYY-MM-DD.json`, regenerate `data/index.json`, `pulse.json`, `feed.xml`.
6. **Commit** — CI commits the data; the static site rebuilds and deploys (GitHub Pages or Vercel — pick whichever the repo owner prefers; Pages matches the QuantumVerse family).

### The Claude API step

- TypeScript, official `@anthropic-ai/sdk`. Model: **`claude-opus-4-8`** by default. (If the owner decides cost matters more than marginal classification quality, `claude-haiku-4-5` at $1/$5 per MTok is a one-line change — that trade-off is the owner's call, not yours.)
- Use **structured outputs**: `client.messages.parse()` with `zodOutputFormat(...)` so every response is a validated array of `{url, category, summary, significance, entities}` — no JSON-repair code.
- Batch ~25 items per request; a daily volume of 30–100 items is one to four calls. If daily volume grows past a few hundred items, switch to the **Message Batches API** (50% cheaper, results well within the daily window).
- The API key lives in a GitHub Actions secret (`ANTHROPIC_API_KEY`), never in the repo.
- Heuristics first, model second: source-level category defaults (an IonQ press release defaults to Hardware; a NIST feed to PQC) go in `sources.yaml` as hints the model can override.

### `sources.yaml` starter set

Verify each feed URL at build time (fetch it, check it parses) rather than trusting this list; drop or fix dead ones and note it in the commit message.

- **Papers:** arXiv API `cat:quant-ph` (this is the volume firehose — apply a significance filter, don't list all ~40/day; keep the top ~10 by the model's significance score)
- **Vendor blogs/newsrooms:** IBM Quantum, Google Quantum AI, Microsoft Azure Quantum, AWS Quantum Technologies, IonQ, Quantinuum, Rigetti, D-Wave, Pasqal, QuEra, Xanadu, PsiQuantum, Alice & Bob, IQM, Infleqtion
- **Media:** The Quantum Insider, Quantum Computing Report, Quantum Zeitgeist, Phys.org (quantum section)
- **Software releases:** GitHub releases Atom feeds for Qiskit, Cirq, PennyLane, NVIDIA CUDA-Q, QuTiP
- **Policy/PQC:** NIST news (PQC), relevant EU/national quantum program feeds
- **Fallback discovery:** one or two Google News RSS queries (e.g. `"quantum computing"` filtered to the last day) to catch stories outside the registry — marked `discovered: true` and held to a higher significance bar

### Item schema (`pulse.json` and daily files share it)

```json
{
  "id": "2026-07-10-ionq-forte-2",
  "date": "2026-07-10",
  "category": "hardware",
  "title": "…",
  "summary": "One to two sentences, our own words.",
  "url": "https://…",
  "source": "ionq-news",
  "also_at": [],
  "significance": 4,
  "qv_device": null,
  "qv_artifact": null
}
```

## Pages

```
/                  Today (or latest crawl day): items grouped by category, significance-ordered
/day/{date}        Any past day's digest (the archive is the URL space)
/category/{slug}   Rolling per-category view, most recent first
/sources           Transparency page: every source, its feed, last-fetched status
/about             What this is, how the crawl works, the QuantumVerse relationship
/pulse.json        The machine-readable feed  ·  /feed.xml  RSS
```

Six page types. Anything else must displace one of these.

## Editorial & legal rules (non-negotiable)

- **Never republish article text.** Headline + our own ≤2-sentence summary + link out. arXiv abstracts may be quoted up to one sentence with attribution; everything else is summarized, not excerpted.
- Respect robots.txt and feed terms; fetch feeds, not full pages, wherever a feed exists.
- Label the summaries honestly: the about page states they are AI-generated and links the methodology.
- Every item links its source prominently — the site's job is to send readers outward.
- No paywalled-content scraping. If a source is paywalled, link the headline only.

## Phasing

| Phase | Ships | Exit gate |
|---|---|---|
| **0** | Repo skeleton, tokens applied, `sources.yaml` with ≥10 verified feeds, crawler runs locally end-to-end once | One manual run produces a real `data/items/{today}.json` and the home page renders it, light + dark, no client JS needed to read |
| **1** | Full pipeline (dedupe, Claude classification via structured outputs, significance), all six page types, `pulse.json` + `feed.xml` | A stranger can answer "what happened in quantum this week?" in two minutes |
| **2** | GitHub Actions daily cron with commit-back, failure alerting (a failed crawl opens an issue), source health on `/sources` | Seven consecutive unattended daily updates |
| **3** | Cross-links live: QuantumVerse home renders the Field Pulse widget from `pulse.json`; `qv_device`/`qv_artifact` slugs start being populated | An Observatory hardware item deep-links to a QuantumVerse device page |

## Quality bar

- Home page LCP < 1.5s on 4G; near-zero client JS (a static site has no excuse)
- WCAG 2.2 AA; keyboard navigation across days (`←`/`→`)
- Crawl budget: the daily action completes in < 5 minutes and < $0.50 of API spend at current volume
- A dead source degrades gracefully and is visibly flagged on `/sources` — never a broken build

## What deliberately does not get built

No accounts, no comments, no newsletter infrastructure (the RSS feed is the newsletter), no search engine (the archive is small and crawlable; browser find + category pages suffice until proven otherwise), no analytics requiring a cookie banner, no CMS — `sources.yaml` and the data files in git *are* the CMS. Every one of these is reversible the day evidence demands it.
