import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  // Server-only module — safe to warn at import time. Any API route that
  // calls OpenAI will fail loudly if this is missing.
  console.warn(
    "[openai] OPENAI_API_KEY is missing. Copy .env.local.example to .env.local and fill in your key."
  );
}

export const openai = new OpenAI({
  // The SDK throws at construction time if `apiKey` is empty/undefined, which
  // would crash every route (and any script) on import. Fall back to a
  // placeholder so the module always loads; real API calls made without a
  // valid key will fail normally at request time with an AuthenticationError.
  apiKey: apiKey || "sk-not-set-see-env-local-example",
});
