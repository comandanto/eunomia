// The app on Cloudflare: static assets from dist/, and the two endpoints the browser cannot do
// for itself — fee sponsorship for passkey wallets, and the RPC behind a provider key — with
// Cloudflare's rate limiters and the Durable Object that holds the relay's daily fee total.
// Each endpoint refuses to work unless its guards are bound.
import { handleRelay, type RateLimiter, type RelayEnv } from "../src/lib/relayHandler";
import { handleRpc } from "../src/lib/rpcProxy";
import { durableBudget, type BudgetNamespace } from "./relayBudget";

export { RelayBudget } from "./relayBudget";

interface Env extends RelayEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RELAY_LIMITER?: RateLimiter;
  RELAY_WALLET_LIMITER?: RateLimiter;
  RELAY_BUDGET?: BudgetNamespace;
  RPC_LIMITER?: RateLimiter;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/rpc") return handleRpc(request, env, env.RPC_LIMITER);
    if (pathname === "/api/relay") {
      return handleRelay(request, env, {
        limiter: env.RELAY_LIMITER,
        walletLimiter: env.RELAY_WALLET_LIMITER,
        budget: env.RELAY_BUDGET ? durableBudget(env.RELAY_BUDGET) : undefined,
      });
    }
    return env.ASSETS.fetch(request);
  },
};
