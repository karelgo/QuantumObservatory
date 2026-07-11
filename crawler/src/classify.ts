import Anthropic from '@anthropic-ai/sdk';
import { AnthropicFoundry } from '@anthropic-ai/foundry-sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { CategorySlug } from './types.js';

// The owner's cost lever: switch to e.g. `claude-haiku-4-5` via env
// without a code change. Default follows BRIEF.md. On Microsoft Foundry
// this must match the Foundry model/deployment name.
const MODEL = process.env.OBSERVATORY_MODEL ?? 'claude-opus-4-8';
const BATCH_SIZE = 25;

/**
 * Endpoint selection, in order of preference:
 * 1. Microsoft Foundry — set ANTHROPIC_FOUNDRY_API_KEY plus either
 *    ANTHROPIC_FOUNDRY_RESOURCE (the resource NAME, e.g. "my-resource" →
 *    https://my-resource.services.ai.azure.com/anthropic/) or
 *    ANTHROPIC_FOUNDRY_BASE_URL (a full endpoint URL). The SDK reads all
 *    three env vars itself. (Structured outputs are beta on Foundry per
 *    Anthropic's platform availability table; a failing batch degrades
 *    to heuristics.)
 * 2. First-party Anthropic API — set ANTHROPIC_API_KEY.
 * Both clients expose the same messages surface.
 */
function makeClient(): Anthropic {
  if (process.env.ANTHROPIC_FOUNDRY_API_KEY) {
    if (!process.env.ANTHROPIC_FOUNDRY_RESOURCE && !process.env.ANTHROPIC_FOUNDRY_BASE_URL) {
      throw new Error(
        'ANTHROPIC_FOUNDRY_API_KEY is set but neither ANTHROPIC_FOUNDRY_RESOURCE (resource name, e.g. "my-resource") nor ANTHROPIC_FOUNDRY_BASE_URL (full endpoint URL) is — set one',
      );
    }
    return new AnthropicFoundry() as unknown as Anthropic;
  }
  return new Anthropic();
}

const CATEGORY_SLUGS = [
  'hardware',
  'research',
  'software',
  'industry',
  'policy',
  'pqc',
  'people',
  'events',
] as const;

export interface ClassifierInput {
  id: string;
  title: string;
  source_name: string;
  category_hint: CategorySlug;
  excerpt?: string;
}

export interface Classification {
  category: CategorySlug;
  summary: string | null;
  significance: number;
}

const OutputSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      category: z.enum(CATEGORY_SLUGS),
      summary: z.string().nullable(),
      significance: z.number(),
    }),
  ),
});

const SYSTEM = `You are the classifier for The Quantum Observatory, a daily digest of quantum computing news. For each input item you assign a category, write a summary, and score significance.

CATEGORIES (assign exactly one):
- hardware: QPUs, chips, qubit-count/fidelity milestones, error-correction demonstrations, hardware roadmaps, control systems, cryogenics
- research: papers, theory, algorithms, physics results (the default for arXiv/journal items unless clearly about hardware milestones)
- software: SDKs, compilers, simulators, developer tools, cloud quantum services, framework releases
- industry: funding rounds, M&A, partnerships, earnings, new companies, market analyses
- policy: government programs, national strategies, export controls, defense initiatives, standards bodies (except cryptography standards)
- pqc: post-quantum cryptography, NIST PQC standards, quantum-safe migration, QKD and quantum-security products
- people: appointments, prizes, notable hires and departures, interviews, obituaries
- events: conferences, CFPs, hackathons, workshops, submission deadlines

SUMMARY RULES (strict):
- One to two plain, factual sentences in your own words.
- Ground every claim ONLY in the given title and excerpt. Never add numbers, names, dates, or claims that are not in the input.
- Never copy the excerpt verbatim; restate it.
- If the input does not contain enough substance for a summary that adds anything beyond the title, return null. A null summary is correct and common — prefer it over padding or speculation.

SIGNIFICANCE (1-5):
- 5: field-defining — a major error-correction/logical-qubit milestone, landmark result, blockbuster funding, or major national policy
- 4: notable to everyone following quantum, regardless of specialty
- 3: notable within its category
- 2: routine — a typical paper, minor release, incremental company news
- 1: marginal, promotional, or listicle content

Return every input id exactly once.`;

/**
 * True when the SDK will find credentials in the environment —
 * Microsoft Foundry (ANTHROPIC_FOUNDRY_API_KEY) or the first-party API
 * (ANTHROPIC_API_KEY). GitHub Actions provides these as repo secrets.
 */
export function hasCredentials(): boolean {
  return Boolean(
    process.env.ANTHROPIC_FOUNDRY_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_AUTH_TOKEN,
  );
}

/**
 * Classify items in batches. Failures are isolated per batch: a failed
 * batch keeps its heuristic values, everything else still lands.
 */
export async function classifyItems(
  inputs: ClassifierInput[],
): Promise<Map<string, Classification>> {
  const client = makeClient();
  const results = new Map<string, Classification>();
  const validIds = new Set(inputs.map((i) => i.id));

  for (let start = 0; start < inputs.length; start += BATCH_SIZE) {
    const batch = inputs.slice(start, start + BATCH_SIZE);
    try {
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Classify these ${batch.length} items:\n\n${JSON.stringify(batch, null, 2)}`,
          },
        ],
        output_config: { format: zodOutputFormat(OutputSchema) },
      });

      const parsed = response.parsed_output;
      if (!parsed) throw new Error('no parsed output');
      for (const item of parsed.items) {
        if (!validIds.has(item.id)) continue; // never trust an invented id
        results.set(item.id, {
          category: item.category,
          summary: item.summary?.trim() || null,
          significance: Math.min(5, Math.max(1, Math.round(item.significance))),
        });
      }
    } catch (err) {
      console.error(
        `  classifier batch ${start / BATCH_SIZE + 1} failed (${batch.length} items keep heuristics): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }
  return results;
}
