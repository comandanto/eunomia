// Vercel serverless function for the relay, kept only until eunomia.finance moves to
// Cloudflare. The logic is host-neutral and lives in src/lib/relayHandler.ts; worker/index.ts
// is the deployment that serves it.
//
// Vercel binds none of the rate limiters or the daily fee budget the handler requires, so
// here it answers every request with 503 by design: nothing is sponsored from this host.
//
// Explicit .js extension: Vercel compiles api/* with node16 resolution, where an extensionless
// relative import does not resolve and the function dies at cold start with a 500. The local
// bundler config maps .js back to .ts, so this satisfies both.
import process from "node:process";
import { handleRelay } from "../src/lib/relayHandler.js";

// Exported as named HTTP methods, not as `export default`. Vercel treats a default export as
// the legacy `(req, res) => void` signature and ignores whatever it returns — so a handler
// written against the Web `Request`/`Response` API produced no response at all and the request
// hung until it timed out. Named methods select the fetch-style signature.
const handler = (req: Request): Promise<Response> => handleRelay(req, process.env);

export const GET = handler;
export const POST = handler;
