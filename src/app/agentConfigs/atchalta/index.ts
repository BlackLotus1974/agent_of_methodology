import { RealtimeAgent, tool } from "@openai/agents/realtime";

/** ---------- THEORY AGENT ---------- **/
// Shared tool: read reference documents from public/atchalta/refs
const referenceReadTool = tool({
  name: "reference_read",
  description:
    "Reads a reference document from /atchalta/refs in this app (Markdown or text). Returns the full text content.",
  parameters: {
    type: "object",
    properties: {
      filename: {
        type: "string",
        description:
          "File name within /atchalta/refs (e.g., 'Atchalta_FieldGuide.md'). Allowed chars: letters, numbers, dot, dash, underscore.",
      },
    },
    required: ["filename"],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    const { filename } = input as { filename: string };
    // Basic sanitization to avoid path traversal
    const isSafe = /^[A-Za-z0-9._-]+$/.test(filename);
    if (!isSafe) {
      return { error: "invalid_filename" } as any;
    }
    const url = `/atchalta/refs/${encodeURIComponent(filename)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return { error: "not_found", status: res.status } as any;
      const content = await res.text();
      return { url, content } as any;
    } catch (err: any) {
      return { error: "fetch_failed" } as any;
    }
  },
});

export const atchaltaTheoryMentor = new RealtimeAgent({
  name: "AtchaltaTheoryMentor",
  voice: "sage",
  handoffDescription:
    "Expert in Atchalta theory: relevance gap, basic/situational surprise, abductive thinking, episteme/techne/phronesis, fox mindset, discovery vs. justification.",
  instructions: `
You are Atchalta’s Theory Mentor. Your job is to ensure analysts apply correct theory:
- Keep them in abductive mode early; prevent premature justification.
- Name concepts precisely: relevance gap, basic vs. situational surprise, tacit knowledge, episteme/techne/phronesis, discovery vs. justification, fox mindset.
- When asked “what/why”, teach theory. When asked “how/next step”, transfer to AtchaltaMethodologyMentor.

Tone: concise, probing, vivid examples, no long lists. Ask 1–2 sharp questions, then deliver the minimal theory needed.

Doc-first policy:
- Before answering on your first turn each session, call reference_read(filename="Atchalta_FieldGuide.md"). Cache a brief outline mentally and reuse it; re-read targeted sections if needed.
- Base all answers on the Field Guide; when you draw from a section, cite it inline as: [Field Guide: <Section Heading>].
- If you have not loaded or cannot cite, do not answer. Prompt: “I’ll load the Field Guide first,” then call reference_read.

Handoff rules:
- If analyst asks about steps, tools, Sensemaker, prompts, or wants to turn text into concepts → transfer to AtchaltaMethodologyMentor.
- If analyst asks to validate stage outputs vs. theory → you answer, then (optionally) transfer back for next steps.
`,
  tools: [referenceReadTool],
  handoffs: [], // wired below
});

/** ---------- METHODOLOGY AGENT ---------- **/
export const atchaltaMethodologyMentor = new RealtimeAgent({
  name: "AtchaltaMethodologyMentor",
  voice: "sage",
  handoffDescription:
    "Expert in Atchalta methodology: Framing → Discovery → Abstraction → Mapping (Sensemaker) → Enrichment → Calibration. Produces concrete next steps and micro-prompts.",
  instructions: `
You are Atchalta’s Methodology Mentor. Drive the process one step at a time.

Open with: "Hi, you're working with Atchalta’s Methodology Mentor. What stage are you at? (Framing, Discovery, Abstraction, Mapping, Enrichment, Calibration). Or do you want to raise a different issue?"

Rules:
- Never skip stages. If unclear, diagnose stage from the analyst’s last output.
- Ask for missing artifacts (raw text, concept titles, current map, cluster names, key insights).
- Give micro-instructions the analyst can execute in 2–5 minutes.
- When ambiguity is high, keep them in abductive mode; ban “final answers”.
- If the analyst asks for theory rationales, transfer to AtchaltaTheoryMentor.

Doc-first policy:
- Before answering on your first turn each session, call reference_read(filename="Atchalta_FieldGuide.md"). Cache a brief outline and reuse it; re-read targeted sections when moving stages.
- Base guidance on the Field Guide; when you use it, cite as [Field Guide: <Section Heading>].
- If not yet loaded or cannot cite, do not answer; load via reference_read first.

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
    referenceReadTool,
    tool({
      name: "sensemaker_vision_read",
      description:
        "Parse a Sensemaker mind map screenshot and return structured data (nodes, clusters, connections, insights). Accepts a filename from /atchalta/uploads or a full URL.",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description:
              "Optional. Image filename in /atchalta/uploads (e.g., 'map1.png'). Allowed chars: letters, numbers, dot, dash, underscore.",
          },
          image_url: {
            type: "string",
            description:
              "Optional. Full URL to the image. If provided, takes precedence over filename.",
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { filename, image_url } = input as {
          filename?: string;
          image_url?: string;
        };

        let url = image_url?.trim();
        if (!url && filename) {
          const isSafe = /^[A-Za-z0-9._-]+$/.test(filename);
          if (!isSafe) return { error: "invalid_filename" } as any;
          url = `/atchalta/uploads/${encodeURIComponent(filename)}`;
        }
        if (!url) return { error: "missing_image" } as any;

        const system = `You are an expert at reading screenshots of Sensemaker-style mind maps.
Return a compact JSON object with:
- nodes: [{ id, title }]
- clusters: [{ name, nodeIds: [ids] }]
- connections: [{ fromId, toId, type }] // type can be 'link' | 'friction' | 'group'
- insights: [{ title, rationale }]
If text is ambiguous or unreadable, include a best-effort guess and add rationale.`;

        const body = {
          model: "gpt-4o-mini",
          input: [
            {
              role: "system",
              content: [{ type: "input_text", text: system }],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: "Extract structured content from this map screenshot. Respond with a single JSON object only.",
                },
                { type: "input_image", image_url: url },
              ],
            },
          ],
        } as any;

        try {
          const res = await fetch("/api/responses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok)
            return { error: "vision_failed", status: res.status } as any;
          const completion = await res.json();
          const outputItems: any[] = completion.output ?? [];
          const text = outputItems
            .filter((it: any) => it.type === "message")
            .flatMap((m: any) => m.content || [])
            .filter((c: any) => c.type === "output_text")
            .map((c: any) => c.text)
            .join("");
          // Try to parse JSON; fall back to raw text
          try {
            const parsed = JSON.parse(text);
            return { image_url: url, parsed } as any;
          } catch {
            return { image_url: url, raw: text } as any;
          }
        } catch {
          return { error: "fetch_failed" } as any;
        }
      },
    }),
    tool({
      name: "sensemaker_note",
      description:
        "Append or transform notes for mapping; returns normalized text blocks ready to paste into Conceptor.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Raw note text to normalize." },
        },
        required: ["text"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { text } = input as { text: string };
        const normalized = (text || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .join("\n");
        return { normalized } as any;
      },
    }),
    tool({
      name: "sensemaker_cluster_hint",
      description:
        "Suggest tentative clusters and names from a set of concept titles.",
      parameters: {
        type: "object",
        properties: {
          titles: {
            type: "array",
            items: { type: "string" },
            description: "List of concept titles to cluster.",
          },
        },
        required: ["titles"],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { titles } = input as { titles: string[] };
        const t = Array.isArray(titles) ? titles.filter(Boolean) : [];
        const midpoint = Math.ceil(t.length / 2);
        const clusters = [
          { name: "Cluster A", titles: t.slice(0, midpoint) },
          { name: "Cluster B", titles: t.slice(midpoint) },
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

const atchaltaAgents = [atchaltaMethodologyMentor, atchaltaTheoryMentor];
export default atchaltaAgents;
