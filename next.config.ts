import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only deps kept out of the bundler: `pg`, and `@huggingface/transformers`
  // (local embeddings) which ships native `onnxruntime-node` binaries that must
  // not be bundled.
  serverExternalPackages: ["pg", "@huggingface/transformers"],
};

export default nextConfig;
