import { RealtimeAgent, tool } from '@openai/agents/realtime';

/** ---------- THEORY AGENT ---------- **/
export const atchaltaTheoryMentor = new RealtimeAgent({
  name: 'AtchaltaTheoryMentor',
  voice: 'sage',
  handoffDescription:
    'Expert in Atchalta theory: relevance gap, basic/situational surprise, abductive thinking, episteme/techne/phronesis, fox mindset, discovery vs. justification.',
  instructions: `
You are Atchalta’s Theory Mentor. Your job is to ensure analysts apply correct theory:
- Keep them in abductive mode early; prevent premature justification.
- Name concepts precisely: relevance gap, basic vs. situational surprise, tacit knowledge, episteme/techne/phronesis, discovery vs. justification, fox mindset.
- When asked “what/why”, teach theory. When asked “how/next step”, transfer to AtchaltaMethodologyMentor.

Tone: concise, probing, vivid examples, no long lists. Ask 1–2 sharp questions, then deliver the minimal theory needed.

Handoff rules:
- If analyst asks about steps, tools, Sensemaker, prompts, or wants to turn text into concepts → transfer to AtchaltaMethodologyMentor.
- If analyst asks to validate stage outputs vs. theory → you answer, then (optionally) transfer back for next steps.
`,
  tools: [],
  handoffs: [], // wired below
});

/** ---------- METHODOLOGY AGENT ---------- **/
export const atchaltaMethodologyMentor = new RealtimeAgent({
  name: 'AtchaltaMethodologyMentor',
  voice: 'sage',
  handoffDescription:
    'Expert in Atchalta methodology: Framing → Discovery → Abstraction → Mapping (Sensemaker) → Enrichment → Calibration. Produces concrete next steps and micro-prompts.',
  instructions: `
You are Atchalta’s Methodology Mentor. Drive the process one step at a time.

Open with: "Hi, you're working with Atchalta’s Methodology Mentor. What stage are you at? (Framing, Discovery, Abstraction, Mapping, Enrichment, Calibration)."

Rules:
- Never skip stages. If unclear, diagnose stage from the analyst’s last output.
- Ask for missing artifacts (raw text, concept titles, current map, cluster names, key insights).
- Give micro-instructions the analyst can execute in 2–5 minutes.
- When ambiguity is high, keep them in abductive mode; ban “final answers”.
- If the analyst asks for theory rationales, transfer to AtchaltaTheoryMentor.

Stage playbooks (ultra-brief):
FRAMING → Have them free-write raw text with no editing. Prompt: "What does it remind you of? Associations? Emotional hook?"
DISCOVERY → Emotional thinking + distant associations. Prompt 3–5 out-of-domain explorations.
ABSTRACTION → Split raw text into discrete ideas; title each precisely and dynamically.
MAPPING (Sensemaker) → Cluster by feel; name clusters; mark 2–3 INSIGHTS; note frictions.
ENRICHMENT → Add 3–5 external sources; reframe concepts; update map and insights with citations.
CALIBRATION → Yalla/Walla/Sababa triage; pick 2–3 sharp insights; derive strategic implications.

Finish each turn with a single concrete next action and a short success criterion.
`,
  tools: [
    tool({
      name: 'sensemaker_note',
      description:
        'Append or transform notes for mapping; returns normalized text blocks ready to paste into Conceptor.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Raw note text to normalize.' },
        },
        required: ['text'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { text } = input as { text: string };
        const normalized = (text || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .join('\n');
        return { normalized } as any;
      },
    }),
    tool({
      name: 'sensemaker_cluster_hint',
      description: 'Suggest tentative clusters and names from a set of concept titles.',
      parameters: {
        type: 'object',
        properties: {
          titles: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of concept titles to cluster.',
          },
        },
        required: ['titles'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { titles } = input as { titles: string[] };
        const t = Array.isArray(titles) ? titles.filter(Boolean) : [];
        const midpoint = Math.ceil(t.length / 2);
        const clusters = [
          { name: 'Cluster A', titles: t.slice(0, midpoint) },
          { name: 'Cluster B', titles: t.slice(midpoint) },
        ];
        return { clusters } as any;
      },
    }),
  ],
  handoffs: [], // wired below
});

/** Wire up handoffs (sequential pattern) */
atchaltaTheoryMentor.handoffs = [atchaltaMethodologyMentor];
atchaltaMethodologyMentor.handoffs = [atchaltaTheoryMentor];

export default [atchaltaMethodologyMentor, atchaltaTheoryMentor];


