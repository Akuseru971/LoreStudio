/**
 * Stub used by Next.js client bundles. The real OpenAI SDK is server-only.
 */
export default class OpenAI {
  constructor() {
    throw new Error("OpenAI SDK must not run in the browser.");
  }
}
