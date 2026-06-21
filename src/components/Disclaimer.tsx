import { DISCLAIMER } from "@/lib/constants";

/** Persistent, always-visible "AI can be wrong" banner. */
export function Disclaimer() {
  return <div className="disclaimer">⚠️ {DISCLAIMER}</div>;
}
