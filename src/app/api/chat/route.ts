import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import { ApprovedSet } from "@/lib/ai/approved";
import type { LeadUIMessage } from "@/lib/ai/messages";
import { resolveChatModel } from "@/lib/ai/provider";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { createTools } from "@/lib/ai/tools";
import { validateOutput } from "@/lib/ai/validate-output";
import { DISCLAIMER } from "@/lib/constants";
import { getRepository } from "@/lib/data/get-repository";
import { logViolation } from "@/lib/logging/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: LeadUIMessage[] } = await req.json();

  const repo = getRepository();
  const approved = new ApprovedSet();
  const tools = createTools(repo, approved);

  const stream = createUIMessageStream<LeadUIMessage>({
    execute: async ({ writer }) => {
      const result = streamText({
        model: resolveChatModel(),
        system: SYSTEM_PROMPT,
        messages: convertToModelMessages(messages),
        tools,
        stopWhen: stepCountIs(6),
      });

      // Stream conversational text to the client as it is generated.
      writer.merge(result.toUIMessageStream());

      // Once generation completes, the per-turn allow-list (approved) is full and
      // the final text is available. Validate, log any violations, and emit the
      // structured, validated references the UI renders as cards.
      const finalText = await result.text;
      const { references, violations } = validateOutput(finalText, approved);
      for (const violation of violations) logViolation(violation);

      writer.write({
        type: "data-listings",
        data: { listings: references, disclaimer: DISCLAIMER },
      });
    },
    onError: (error) => {
      console.error("[/api/chat] stream error:", error);
      return "An error occurred while generating a response.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
