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

### Classifier configuration

The classifier picks its endpoint from the environment (and skips gracefully when neither is configured — heuristic categories, no summaries):

| Endpoint | Environment |
|---|---|
| **Microsoft Foundry** (preferred) | `ANTHROPIC_FOUNDRY_API_KEY` + `ANTHROPIC_FOUNDRY_RESOURCE` (resource **name**, e.g. `my-resource` → `https://my-resource.services.ai.azure.com/anthropic/`; or `ANTHROPIC_FOUNDRY_BASE_URL` with the full endpoint URL) |
| First-party Anthropic API | `ANTHROPIC_API_KEY` |

`OBSERVATORY_MODEL` overrides the model (default `claude-opus-4-8`; on Foundry it must match your Foundry model/deployment name). For the daily workflow, set these under *Settings → Secrets and variables → Actions* — keys as **secrets**, the resource host as a **variable**.

## Principles

- **Never republish article text.** Headline + our own ≤2-sentence summary + link out.
- **Readable without JavaScript.** Every page server-renders completely.
- **The URL is the state.** `/day/2026-07-11` is the archive; `pulse.json` is the API.
- **Transparent sources.** `/sources` lists every feed and its health.

Full plan and agent brief: [BRIEF.md](BRIEF.md).
