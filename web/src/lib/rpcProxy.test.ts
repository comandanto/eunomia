import { describe, expect, it, vi } from "vitest";
import { MAX_BODY_BYTES, handleRpc } from "./rpcProxy";

const UPSTREAM = "https://provider.example/v1/secret-key";
const env = { RELAY_RPC_URL: UPSTREAM };
const open = { limit: async () => ({ success: true }) };

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://app.example/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "1.2.3.4", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const upstreamOk = () =>
  vi.fn(async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { sequence: 7 } })));

describe("handleRpc", () => {
  it("forwards an allowed call to the provider and returns its answer", async () => {
    const fetchFn = upstreamOk();
    const res = await handleRpc(post({ jsonrpc: "2.0", id: 1, method: "getLatestLedger" }), env, open, fetchFn);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jsonrpc: "2.0", id: 1, result: { sequence: 7 } });
    expect(fetchFn).toHaveBeenCalledWith(UPSTREAM, expect.objectContaining({ method: "POST" }));
  });

  it("refuses a method the app never calls, without spending a call", async () => {
    const fetchFn = upstreamOk();
    const res = await handleRpc(post({ jsonrpc: "2.0", id: 9, method: "getAccountSecrets" }), env, open, fetchFn);
    expect(res.status).toBe(403);
    expect((await res.json()).id).toBe(9);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses a batch: one rate-limit token buys one call", async () => {
    const fetchFn = upstreamOk();
    const batch = [{ jsonrpc: "2.0", id: 1, method: "getHealth" }, { jsonrpc: "2.0", id: 2, method: "getHealth" }];
    expect((await handleRpc(post(batch), env, open, fetchFn)).status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuses an oversized body and anything that is not JSON", async () => {
    const fetchFn = upstreamOk();
    const big = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "simulateTransaction", params: { transaction: "A".repeat(MAX_BODY_BYTES) } });
    expect((await handleRpc(post(big), env, open, fetchFn)).status).toBe(413);
    expect((await handleRpc(post("{not json"), env, open, fetchFn)).status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("answers 429 when the caller's rate is spent", async () => {
    const shut = { limit: async () => ({ success: false }) };
    const res = await handleRpc(post({ jsonrpc: "2.0", id: 1, method: "getHealth" }), env, shut, upstreamOk());
    expect(res.status).toBe(429);
  });

  it("fails closed without a provider or a limiter", async () => {
    const call = { jsonrpc: "2.0", id: 1, method: "getHealth" };
    expect((await handleRpc(post(call), {}, open, upstreamOk())).status).toBe(503);
    expect((await handleRpc(post(call), env, undefined, upstreamOk())).status).toBe(503);
  });

  it("never puts the provider's URL in what the caller sees", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error(`fetch to ${UPSTREAM} failed`);
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleRpc(post({ jsonrpc: "2.0", id: 3, method: "getHealth" }), env, open, fetchFn);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret-key");
  });

  it("only takes POST", async () => {
    const res = await handleRpc(new Request("https://app.example/api/rpc"), env, open, upstreamOk());
    expect(res.status).toBe(405);
  });
});
