import { describe, it, expect, vi } from "vitest";
import { getXlmBalance, needsFunding, MIN_XLM } from "./funding";

const res = (status: number, body?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("getXlmBalance", () => {
  it("returns the native balance", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      res(200, {
        balances: [
          { asset_type: "credit_alphanum4", balance: "9.0000000" },
          { asset_type: "native", balance: "123.4567890" },
        ],
      }),
    );
    expect(await getXlmBalance("GABC", fetchFn)).toBeCloseTo(123.456789);
  });

  it("returns null for a not-yet-created account (404)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(404));
    expect(await getXlmBalance("GABC", fetchFn)).toBeNull();
  });

  it("throws on other Horizon errors", async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(500));
    await expect(getXlmBalance("GABC", fetchFn)).rejects.toThrow(/500/);
  });
});

describe("needsFunding", () => {
  it("flags missing accounts and low balances", () => {
    expect(needsFunding(null)).toBe(true);
    expect(needsFunding(MIN_XLM - 1)).toBe(true);
    expect(needsFunding(MIN_XLM)).toBe(false);
  });
});
