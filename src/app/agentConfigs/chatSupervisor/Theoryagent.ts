import { RealtimeItem, tool } from '@openai/agents/realtime';


import {
  exampleAccountInfo,
  examplePolicyDocs,
  exampleStoreLocations,
} from './sampleData';

export const supervisorAgentInstructions = `You are an expert in Atchalta's theory and methodology, tasked with providing real-time guidance to analysts who are working on developing new knowledge. You will be given detailed response instructions, relevant tools, and the full conversation history so far, and you should create a correct next message that the analyst can read and act on directly.

# Instructions
- You can provide an answer directly, or recommend a methodology step, tool, or prompt before answering the question.
- If you need more information to proceed, ask the analyst for it explicitly before continuing.
- Your message will be read verbatim by the analyst, so write as if you were directly coaching them.

==== Domain-Specific Agent Instructions ====
You are a helpful, insightful mentor in Atchalta’s knowledge-development process, supporting analysts in:
- Applying core concepts: basic surprise, situational surprise, relevance gap, tacit knowledge, abductive thinking, episteme, techne, phronesis, discovery vs. justification, and the “fox” mindset.
- Using the Atchalta methodology stages: framing, discovery, abstraction, conceptual scaffolding, mapping in Sensemaker, enriching from external sources, and strategic calibration.
- Encouraging associative thinking, emotional thinking, and conceptual reframing.
- Ensuring outputs follow the methodology’s structured flow from initial raw text → concepts → map → insights → reframed strategic implications.

# Instructions
- Always begin first interaction with: "Hi, you're working with Atchalta’s Knowledge Mentor. How would you like to advance your thinking today?"
- Guide the analyst through the next most logical methodological step, even if they have not explicitly asked for it.
- Never skip abductive exploration when new knowledge is needed; help the analyst avoid falling into justification bias.
- Encourage “fox” mode — moving across silos, exploring distant associations, and connecting concepts — rather than “hedgehog” tunnel vision.
- Avoid unrelated topics (politics, religion, current affairs, legal/medical/financial advice) unless they are explicitly part of the analytical mission.
- Use methodology-specific prompts when leveraging AI tools, and always remind the analyst that AI is an aid, not a source of new knowledge.
- Reference methodology terms precisely and model their correct use.
- When helping with Sensemaker mapping, be explicit about node grouping, cluster naming, and identifying potential insights.

# Response Instructions
- Maintain a concise but stimulating tone, prompting deeper thinking rather than giving final answers.
- This is for a voice-style conversation: be clear, avoid lists unless absolutely necessary, and favor short, thought-provoking prose.
- If the analyst is stuck, use methodological questions to help them surface tacit knowledge, e.g.:
    - “What does this remind you of?”
    - “Where might there be a relevance gap here?”
    - “What’s the emotional resonance of this issue for you?”
- Never move to an advanced stage before the previous stage has produced useful output.
- Never let the analyst bypass the framing and discovery phases unless there’s a strategic reason.

# Sample Phrases
## Encouraging discovery
- "Let’s stay in the pre-hypothesis space a bit longer — what else might this connect to?"
- "If we think like foxes, what other fields or cases might illuminate this?"
- "What’s the gap between how people see this and what’s actually happening?"

## If information is missing
- "To move forward, I’ll need you to share the raw thoughts or text you’ve written so far."
- "Could you describe the central challenge in your own words before we start mapping?"

## Moving to mapping
- "It’s time to break your raw text into discrete concepts. Let’s find the titles that capture each idea’s essence."
- "Now let’s cluster related concepts in Sensemaker — don’t overthink the logic yet, just group by feel."

## Enriching from external sources
- "This might be the moment to look outward. Which of your key concepts would benefit most from outside perspectives?"

# User Message Format
- Always provide your final mentoring message to the analyst.
- When referring to theory or methodology, cite the concept name exactly as in Atchalta’s framework (e.g., “basic surprise,” “conceptual scaffolding”).
- Only provide process, theory, or methodological guidance that is part of Atchalta’s framework or its applied tools.

# Example (methodological nudge)
- Analyst: I think I already know the answer to this challenge.
- Supervisor Assistant:
# Message
Let’s slow down before locking in. Try exploring distant associations — what seemingly unrelated domains might shed light here? Remember, we’re in the abductive phase, so resist the urge to justify just yet.

# Example (Sensemaker guidance)
- Analyst: I’ve written my first raw text.
- Supervisor Assistant:
# Message
Great. Now read it again, and after each idea, hit Enter twice. Above each segment, write a short, precise title that captures its essence. Keep it specific, dynamic, and concept-driven. This will prepare us for clustering in Sensemaker.
`;

export const supervisorAgentTools = [
  {
    type: "function",
    name: "lookupPolicyDocument",
    description:
      "Tool to look up internal documents and policies by topic or keyword.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "The topic or keyword to search for in company policies or documents.",
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "getUserAccountInfo",
    description:
      "Tool to get user account information. This only reads user accounts information, and doesn't provide the ability to modify or delete any values.",
    parameters: {
      type: "object",
      properties: {
        phone_number: {
          type: "string",
          description:
            "Formatted as '(xxx) xxx-xxxx'. MUST be provided by the user, never a null or empty string.",
        },
      },
      required: ["phone_number"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "findNearestStore",
    description:
      "Tool to find the nearest store location to a customer, given their zip code.",
    parameters: {
      type: "object",
      properties: {
        zip_code: {
          type: "string",
          description: "The customer's 5-digit zip code.",
        },
      },
      required: ["zip_code"],
      additionalProperties: false,
    },
  },
];

async function fetchResponsesMessage(body: any) {
  const response = await fetch('/api/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // Preserve the previous behaviour of forcing sequential tool calls.
    body: JSON.stringify({ ...body, parallel_tool_calls: false }),
  });

  if (!response.ok) {
    console.warn('Server returned an error:', response);
    return { error: 'Something went wrong.' };
  }

  const completion = await response.json();
  return completion;
}

function getToolResponse(fName: string) {
  switch (fName) {
    case "getUserAccountInfo":
      return exampleAccountInfo;
    case "lookupPolicyDocument":
      return examplePolicyDocs;
    case "findNearestStore":
      return exampleStoreLocations;
    default:
      return { result: true };
  }
}

/**
 * Iteratively handles function calls returned by the Responses API until the
 * supervisor produces a final textual answer. Returns that answer as a string.
 */
async function handleToolCalls(
  body: any,
  response: any,
  addBreadcrumb?: (title: string, data?: any) => void,
) {
  let currentResponse = response;

  while (true) {
    if (currentResponse?.error) {
      return { error: 'Something went wrong.' } as any;
    }

    const outputItems: any[] = currentResponse.output ?? [];

    // Gather all function calls in the output.
    const functionCalls = outputItems.filter((item) => item.type === 'function_call');

    if (functionCalls.length === 0) {
      // No more function calls – build and return the assistant's final message.
      const assistantMessages = outputItems.filter((item) => item.type === 'message');

      const finalText = assistantMessages
        .map((msg: any) => {
          const contentArr = msg.content ?? [];
          return contentArr
            .filter((c: any) => c.type === 'output_text')
            .map((c: any) => c.text)
            .join('');
        })
        .join('\n');

      return finalText;
    }

    // For each function call returned by the supervisor model, execute it locally and append its
    // output to the request body as a `function_call_output` item.
    for (const toolCall of functionCalls) {
      const fName = toolCall.name;
      const args = JSON.parse(toolCall.arguments || '{}');
      const toolRes = getToolResponse(fName);

      // Since we're using a local function, we don't need to add our own breadcrumbs
      if (addBreadcrumb) {
        addBreadcrumb(`[supervisorAgent] function call: ${fName}`, args);
      }
      if (addBreadcrumb) {
        addBreadcrumb(`[supervisorAgent] function call result: ${fName}`, toolRes);
      }

      // Add function call and result to the request body to send back to realtime
      body.input.push(
        {
          type: 'function_call',
          call_id: toolCall.call_id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
        {
          type: 'function_call_output',
          call_id: toolCall.call_id,
          output: JSON.stringify(toolRes),
        },
      );
    }

    // Make the follow-up request including the tool outputs.
    currentResponse = await fetchResponsesMessage(body);
  }
}

export const getNextResponseFromSupervisor = tool({
  name: 'getNextResponseFromSupervisor',
  description:
    'Determines the next response whenever the agent faces a non-trivial decision, produced by a highly intelligent supervisor agent. Returns a message describing what to do next.',
  parameters: {
    type: 'object',
    properties: {
      relevantContextFromLastUserMessage: {
        type: 'string',
        description:
          'Key information from the user described in their most recent message. This is critical to provide as the supervisor agent with full context as the last message might not be available. Okay to omit if the user message didn\'t add any new information.',
      },
    },
    required: ['relevantContextFromLastUserMessage'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const { relevantContextFromLastUserMessage } = input as {
      relevantContextFromLastUserMessage: string;
    };

    const addBreadcrumb = (details?.context as any)?.addTranscriptBreadcrumb as
      | ((title: string, data?: any) => void)
      | undefined;

    const history: RealtimeItem[] = (details?.context as any)?.history ?? [];
    const filteredLogs = history.filter((log) => log.type === 'message');

    const body: any = {
      model: 'gpt-4.1',
      input: [
        {
          type: 'message',
          role: 'system',
          content: supervisorAgentInstructions,
        },
        {
          type: 'message',
          role: 'user',
          content: `==== Conversation History ====
          ${JSON.stringify(filteredLogs, null, 2)}
          
          ==== Relevant Context From Last User Message ===
          ${relevantContextFromLastUserMessage}
          `,
        },
      ],
      tools: supervisorAgentTools,
    };

    const response = await fetchResponsesMessage(body);
    if (response.error) {
      return { error: 'Something went wrong.' };
    }

    const finalText = await handleToolCalls(body, response, addBreadcrumb);
    if ((finalText as any)?.error) {
      return { error: 'Something went wrong.' };
    }

    return { nextResponse: finalText as string };
  },
});
  