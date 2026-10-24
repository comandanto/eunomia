import { describe, it, expect } from "vitest";
import { Asset, Networks } from "@stellar/stellar-sdk";
import { USDC_TOKEN, USDC_ISSUER, tokenCodeOf, tokenIdOf } from "./token";
import { XLM_SAC } from "./userTreasury";

describe("token", () => {
  it("pins USDC_TOKEN to the contract Circle's issuer derives", () => {
    // If the id and the issuer ever disagree, this fails before a treasury is created over a
    // token nobody holds.
    const usdc = new Asset("USDC", USDC_ISSUER);
    expect(usdc.contractId(Networks.PUBLIC)).toBe(USDC_TOKEN);
  });

  it("pins XLM_SAC to the native asset's contract", () => {
    expect(Asset.native().contractId(Networks.PUBLIC)).toBe(XLM_SAC);
  });

  it("labels a treasury by the token it holds", () => {
    expect(tokenCodeOf(USDC_TOKEN)).toBe("USDC");
    expect(tokenCodeOf(XLM_SAC)).toBe("XLM");
  });

  it("reads an unknown or missing token as XLM — what every early treasury is", () => {
    expect(tokenCodeOf(undefined)).toBe("XLM");
    expect(tokenCodeOf(null)).toBe("XLM");
    expect(tokenCodeOf("CDCEHPK4OJXVRA4JV7N56GR5SRD5KGGZ55BDSHKODGR72Y4KGS6A3Y2W")).toBe("XLM");
  });

  it("round-trips code and id", () => {
    expect(tokenCodeOf(tokenIdOf("USDC"))).toBe("USDC");
    expect(tokenCodeOf(tokenIdOf("XLM"))).toBe("XLM");
  });
});
