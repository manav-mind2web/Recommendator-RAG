import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Resolves the chat model from the PROVIDER env var. Anthropic, OpenAI, and
 * Google (Gemini) are all wired; swapping is a one-line env change. Model ids
 * are overridable via env so a cheaper model can be used on this tiny dataset
 * without code changes.
 */
export function resolveChatModel(): LanguageModel {
  const provider = (process.env.PROVIDER ?? "anthropic").toLowerCase();

  if (provider === "openai") {
    return openai(process.env.OPENAI_MODEL ?? "gpt-4o");
  }
  if (provider === "anthropic") {
    return anthropic(process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8");
  }
  if (provider === "google" || provider === "gemini") {
    return google(process.env.GOOGLE_MODEL ?? "gemini-2.5-flash");
  }

  throw new Error(
    `Unknown PROVIDER "${provider}". Set PROVIDER to "anthropic", "openai", or "google".`,
  );
}
