// The browser's way to Stellar: /api/rpc forwards JSON-RPC to the provider this deployment
// pays for. Host-neutral like relayHandler; the worker passes its env and limiter in.
//
// Why not call the provider from the page: its URL carries the account key, and anything in
// the bundle is public. Here the URL stays a worker secret (RELAY_RPC_URL, the same provider
// the relay prices and submits through), and the page and the relay read one chain.
//
// It is an open endpoint on our bill, so it forwards only what the app calls — reads,
// simulations and submitting a transaction the caller already signed — one request at a time,
// within a size bound and a per-IP rate. It adds no authority: anything sent through it could
// be sent to any public RPC.
import { clean, type RateLimiter } from "./relayHandler.js";

export interface RpcEnv {
  RELAY_RPC_URL?: string;
}

/** The JSON-RPC methods the app uses. Anything else is refused before it costs a call. */
export const RPC_METHODS: ReadonlySet<string> = new Set([
  "getHealth",
  "getNetwork",
  "getVersionInfo",
  "getLatestLedger",
  "getLedgers",
  "getLedgerEntries",
  "getFeeStats",
  "getEvents",
  "getTransaction",
  "getTransactions",
  "simulateTransaction",
  "sendTransaction",
]);

/** Large enough for any transaction the app builds (a factory create with payees is a few
 *  KB); small enough that the endpoint is useless for pushing contract code. */
export const MAX_BODY_BYTES = 64 * 1024;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/** A JSON-RPC error the SDK will surface as such, with the request's id when it had one. */
const rpcError = (status: number, id: unknown, message: string): Response =>
  json(status, { jsonrpc: "2.0", id: id ?? null, error: { code: -32600, message } });

export async function handleRpc(
  request: Request,
  env: RpcEnv,
  limiter: RateLimiter | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "POST") return rpcError(405, null, "POST only.");
  const upstream = clean(env.RELAY_RPC_URL);
  // Fails closed: without a provider or a limiter this endpoint would be a hole, not a feature.
  if (!upstream || !limiter) {
    console.error("[rpc] not configured:", !upstream ? "RELAY_RPC_URL" : "RPC_LIMITER");
    return rpcError(503, null, "Unavailable.");
  }

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await limiter.limit({ key: ip })).success) return rpcError(429, null, "Too many requests.");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return rpcError(413, null, "Request too large.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return rpcError(413, null, "Request too large.");

  let call: { jsonrpc?: unknown; id?: unknown; method?: unknown };
  try {
    call = JSON.parse(text);
  } catch {
    return rpcError(400, null, "Not JSON.");
  }
  // One call per request: a batch would multiply what one rate-limit token buys.
  if (!call || typeof call !== "object" || Array.isArray(call)) {
    return rpcError(400, null, "One JSON-RPC call per request.");
  }
  if (typeof call.method !== "string" || !RPC_METHODS.has(call.method)) {
    return rpcError(403, call.id, "Method not allowed.");
  }

  try {
    const res = await fetchFn(upstream, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
    });
    return new Response(res.body, {
      status: res.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (e) {
    // The provider's URL is the secret; its error text can quote it, so it stays in the log.
    console.error("[rpc] upstream failed:", e instanceof Error ? e.name : "error");
    return rpcError(502, call.id, "Upstream unavailable.");
  }
}
