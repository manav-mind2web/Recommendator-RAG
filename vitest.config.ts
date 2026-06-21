import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Loads .env so the key-gated live-model eval cases can run when a key is present.
    setupFiles: ["dotenv/config"],
  },
});
