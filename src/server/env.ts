/**
 * Central, server-side access to configuration.
 * Used by the Next.js server and the standalone Temporal worker.
 * Nothing under src/server may be imported by client components: it reads secrets.
 */

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export const env = {
  mongoUri: () => optional("MONGODB_URI"),
  mongoDbName: () => optional("MONGODB_DB") ?? "kutumb",

  sessionSecret: () => {
    const secret = optional("SESSION_SECRET");
    if (secret && secret.length >= 32) return secret;
    if (process.env.NODE_ENV !== "production") {
      // Development convenience only. Production refuses to run without a real secret.
      return "dev-only-insecure-session-secret-change-me-please";
    }
    throw new Error("SESSION_SECRET must be set (32+ characters) in production.");
  },

  googleApiKey: () => optional("GOOGLE_GENERATIVE_AI_API_KEY") ?? optional("GEMINI_API_KEY"),
  gemmaModel: () => optional("GEMMA_MODEL") ?? "gemma-4-26b-a4b-it",

  // Voice (STT + TTS) runs entirely in the browser via the Web Speech API — no server keys needed.

  temporalAddress: () => optional("TEMPORAL_ADDRESS") ?? "localhost:7233",
  temporalNamespace: () => optional("TEMPORAL_NAMESPACE") ?? "default",
  temporalApiKey: () => optional("TEMPORAL_API_KEY"),
  temporalTaskQueue: () => optional("TEMPORAL_TASK_QUEUE") ?? "kutumb-reminders",

  sentryDsn: () => optional("SENTRY_DSN"),
};
