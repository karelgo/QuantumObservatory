# The Quantum Observatory

**A daily-updated, categorized overview of everything happening in quantum computing.**

One observatory watches the machines; this one watches the field. Every day an automated crawl reads the quantum ecosystem — vendor newsrooms, arXiv, SDK releases, media, policy feeds — and collapses it into one definite digest: headline, a one-to-two-sentence original summary, a category, and a link out. A reading instrument, not a content farm.

A sister project to [QuantumVerse](https://github.com/karelgo/QuantumVerse), the home for quantum artifacts. QuantumVerse hosts what the field *builds*; the Observatory reports what the field *does*.

## The eight categories

Hardware & QPUs · Research & Papers · Software & Tools · Industry & Funding · Government & Policy · Post-Quantum Security · People & Community · Events

## How it works

```
sources.yaml            the source registry — the editorial heart
crawler/                fetch → normalize → dedupe → classify → rank → write
data/items/YYYY-MM-DD.json   one committed file per day, append-only
web/                    static Next.js site rendered from data/
```

No database, no server state. A GitHub Actions cron runs the crawl daily, commits the data, and the static site rebuilds. Classification and summaries come from Claude with structured outputs; heuristics from `sources.yaml` come first, the model refines.

### Hosting

The site is a static export (`next build` with `output: 'export'`), so it needs a file server and nothing else. It is published to **GitHub Pages** at <https://karelgo.github.io/QuantumObservatory/> by `.github/workflows/deploy.yml`, which builds `web/out/` and uploads it as the Pages artifact.

One-time setup: *Settings → Pages → Source → **GitHub Actions***. This cannot be automated — `GITHUB_TOKEN` is refused permission to create a Pages site — and it is not optional. Left on the default *Deploy from a branch*, Pages runs Jekyll over the repository root and serves this README as the home page instead of the site.

Deploys are triggered by a push to `main` that touches `data/`, `web/`, or `sources.yaml`; by a successful **Daily crawl**; and manually via *Run workflow*. The crawl needs its own trigger because pushes made with `GITHUB_TOKEN` deliberately do not start other workflows.

`SITE_URL` is the only deployment knob. Its path segment becomes Next's `basePath` — `/QuantumObservatory` for a project Pages site, empty for a domain root — and the crawler stamps the same URL into `pulse.json` and `feed.xml`. The deploy workflow reads it from the Pages API, so a **custom domain** needs only *Settings → Pages → Custom domain*, plus the repository variable `SITE_URL` set to the same address to keep the feeds in sync. Local `npm run dev` leaves it unset and serves from `/` as before.

Any static host works equally well — Cloudflare Pages and Netlify both build with `npm run build`, publish `web/out`, and want `SITE_URL` set to the site's address.

### Classifier configuration

The classifier picks the first configured backend from the environment (and skips gracefully when none is set — heuristic categories, no summaries):

| Backend | Environment | Default model |
|---|---|---|
| **Azure AI Foundry** (OpenAI-compatible, in use) | `AZURE_FOUNDRY_API_KEY` + `AZURE_FOUNDRY_ENDPOINT` (the `/openai/v1` base URL) | `gpt-5.4-nano` |
| Anthropic on Foundry (a Claude deployment) | `ANTHROPIC_FOUNDRY_API_KEY` + `ANTHROPIC_FOUNDRY_RESOURCE` (or `…_BASE_URL`) | `claude-opus-4-8` |
| First-party Anthropic API | `ANTHROPIC_API_KEY` | `claude-opus-4-8` |

`OBSERVATORY_MODEL` overrides the model — on Azure Foundry it must match your **deployment name**. Copy `.env.example` to `.env.local` (gitignored) for local runs, or set these under *Settings → Secrets and variables → Actions* for the daily workflow (keys as **secrets**, URLs and model as **variables**). The classifier uses schema-strict structured outputs on either backend, so responses are always validated JSON.

## Principles

- **Never republish article text.** Headline + our own ≤2-sentence summary + link out.
- **Readable without JavaScript.** Every page server-renders completely.
- **The URL is the state.** `/day/2026-07-11` is the archive; `pulse.json` is the API.
- **Transparent sources.** `/sources` lists every feed and its health.

Full plan and agent brief: [BRIEF.md](BRIEF.md).
