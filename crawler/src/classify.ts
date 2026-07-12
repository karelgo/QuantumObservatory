import Anthropic from '@anthropic-ai/sdk';
import { AnthropicFoundry } from '@anthropic-ai/foundry-sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import OpenAI from 'openai';
import { z } from 'zod';
import type { CategorySlug } from './types.js';

const BATCH_SIZE = 25;

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
type Output = z.infer<typeof OutputSchema>;

// Hand-written JSON Schema for OpenAI strict structured outputs. Kept in
// lockstep with OutputSchema above (strict mode requires every property
// listed in `required` and additionalProperties:false).
const OPENAI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          category: { type: 'string', enum: CATEGORY_SLUGS },
          summary: { type: ['string', 'null'] },
          significance: { type: 'integer' },
        },
        required: ['id', 'category', 'summary', 'significance'],
      },
    },
  },
  required: ['items'],
} as const;

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

// ── Backends ───────────────────────────────────────────────────────
// One `complete(system, user) -> validated Output` per provider, chosen
// from the environment. Adding a provider is one Backend implementation.

interface Backend {
  label: string;
  model: string;
  complete(system: string, user: string): Promise<Output>;
}

function userPrompt(batch: ClassifierInput[]): string {
  return `Classify these ${batch.length} items:\n\n${JSON.stringify(batch, null, 2)}`;
}

/** Azure AI Foundry (or any OpenAI-compatible endpoint) via the OpenAI SDK. */
function openAIBackend(): Backend {
  const model = process.env.OBSERVATORY_MODEL ?? 'gpt-5.4-nano';
  const client = new OpenAI({
    apiKey: process.env.AZURE_FOUNDRY_API_KEY,
    baseURL: process.env.AZURE_FOUNDRY_ENDPOINT,
  });
  return {
    label: `Azure Foundry (${model})`,
    model,
    async complete(system, user) {
      const resp = await client.chat.completions.create({
        model,
        // Generous ceiling: gpt-5.x models spend reasoning tokens that
        // count against this, and a truncated batch would fail to parse.
        max_completion_tokens: 16000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'classifications', strict: true, schema: OPENAI_JSON_SCHEMA },
        },
      });
      const choice = resp.choices[0];
      if (choice?.finish_reason === 'length') {
        throw new Error('response truncated (max_completion_tokens) — batch too large');
      }
      const content = choice?.message?.content;
      if (!content) throw new Error('empty completion');
      return OutputSchema.parse(JSON.parse(content));
    },
  };
}

/** Anthropic — first-party API or Anthropic-on-Foundry. */
function anthropicBackend(): Backend {
  const model = process.env.OBSERVATORY_MODEL ?? 'claude-opus-4-8';
  let client: Anthropic;
  let label: string;
  if (process.env.ANTHROPIC_FOUNDRY_API_KEY) {
    if (!process.env.ANTHROPIC_FOUNDRY_RESOURCE && !process.env.ANTHROPIC_FOUNDRY_BASE_URL) {
      throw new Error(
        'ANTHROPIC_FOUNDRY_API_KEY is set but neither ANTHROPIC_FOUNDRY_RESOURCE (resource name, e.g. "my-resource") nor ANTHROPIC_FOUNDRY_BASE_URL (full endpoint URL) is — set one',
      );
    }
    client = new AnthropicFoundry() as unknown as Anthropic;
    label = `Anthropic on Foundry (${model})`;
  } else {
    client = new Anthropic();
    label = `Anthropic API (${model})`;
  }
  return {
    label,
    model,
    async complete(system, user) {
      const resp = await client.messages.parse({
        model,
        max_tokens: 8000,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { format: zodOutputFormat(OutputSchema) },
      });
      if (!resp.parsed_output) throw new Error('no parsed output');
      return resp.parsed_output;
    },
  };
}

/**
 * Backend selection, in order of preference:
 * 1. Azure AI Foundry (OpenAI-compatible) — AZURE_FOUNDRY_API_KEY +
 *    AZURE_FOUNDRY_ENDPOINT (the `/openai/v1` base URL); OBSERVATORY_MODEL
 *    is the deployment name (default gpt-5.4-nano).
 * 2. Anthropic on Foundry — ANTHROPIC_FOUNDRY_API_KEY (+ resource/base URL).
 * 3. First-party Anthropic API — ANTHROPIC_API_KEY.
 * Returns null when nothing is configured.
 */
function makeBackend(): Backend | null {
  if (process.env.AZURE_FOUNDRY_API_KEY) return openAIBackend();
  if (process.env.ANTHROPIC_FOUNDRY_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    return anthropicBackend();
  }
  return null;
}

/** True when a classification backend is configured in the environment. */
export function hasCredentials(): boolean {
  return Boolean(
    process.env.AZURE_FOUNDRY_API_KEY ||
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
  const backend = makeBackend();
  if (!backend) throw new Error('no classification backend configured');
  console.log(`  backend: ${backend.label}`);

  const results = new Map<string, Classification>();
  const validIds = new Set(inputs.map((i) => i.id));

  for (let start = 0; start < inputs.length; start += BATCH_SIZE) {
    const batch = inputs.slice(start, start + BATCH_SIZE);
    try {
      const parsed = await backend.complete(SYSTEM, userPrompt(batch));
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
