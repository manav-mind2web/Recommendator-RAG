import { generateText, stepCountIs, type LanguageModel, type ModelMessage } from "ai";
import type { ListingRepository } from "../data/repository";
import type { ListingCard } from "../data/schema";
import type { Violation } from "../logging/logger";
import { ApprovedSet } from "./approved";
import { SYSTEM_PROMPT } from "./system-prompt";
import { createTools } from "./tools";
import { validateOutput } from "./validate-output";

export interface GroundedTurnResult {
  text: string;
  references: ListingCard[];
  violations: Violation[];
}

/**
 * Non-streaming counterpart of the chat route's logic, sharing the exact same
 * tools + system prompt + validator. Used by the eval suite so the required
 * scenarios are exercised end-to-end without an HTTP/streaming harness.
 */
export async function generateGroundedTurn(opts: {
  model: LanguageModel;
  repo: ListingRepository;
  messages: ModelMessage[];
}): Promise<GroundedTurnResult> {
  const approved = new ApprovedSet();
  const tools = createTools(opts.repo, approved);

  const result = await generateText({
    model: opts.model,
    system: SYSTEM_PROMPT,
    messages: opts.messages,
    tools,
    stopWhen: stepCountIs(6),
  });

  const { references, violations } = validateOutput(result.text, approved);
  return { text: result.text, references, violations };
}
