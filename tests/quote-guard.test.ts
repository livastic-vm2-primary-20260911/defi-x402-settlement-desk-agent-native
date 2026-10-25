import { describe, expect, it } from "vitest";
import { BASE_NATIVE_USDC, formatMicro, parseUsdcLimit, reviewQuote } from "../shared/quote-guard";

const RECEIVER = "0x1234567890123456789012345678901234567890";
function quote(patch: Record<string, unknown> = {}) {
  return JSON.stringify({
    x402Version: 2,
    resource: { url: "https://vendor.example/api/quote" },
    accepts: [{
      scheme: "exact",
      network: "eip155:8453",
      amount: "10000",
      asset: BASE_NATIVE_USDC,
      payTo: RECEIVER,
      maxTimeoutSeconds: 300,
      ...patch
    }]
  });
}
function review(text: string, cap = "0.02", expectedRecipient = RECEIVER) {
  return reviewQuote({ quoteText: text, maxSpendUsdc: cap, expectedRecipient });
}
describe("offline x402 payment terms guard", () => {
  it("accepts canonical single 0.01 USDC quote for *human review* only", () => {
    const r = review(quote());
    expect(r.decision).toBe("READY_FOR_HUMAN_REVIEW");
    expect(r.automaticPaymentAllowed).toBe(false);
    expect(r.options[0].amountUsdc).toBe("0.010000");
  });
  it("blocks wrong chain", () => expect(review(quote({ network: "eip155:1" })).decision).toBe("BLOCK"));
  it("blocks bridged or impostor token", () => expect(review(quote({ asset: "0x0000000000000000000000000000000000000001" })).decision).toBe("BLOCK"));
  it("blocks over-budget even by one micro", () => expect(review(quote({ amount: "20001" })).decision).toBe("BLOCK"));
  it("blocks altered recipient", () => expect(review(quote({ payTo: "0x9999999999999999999999999999999999999999" })).decision).toBe("BLOCK"));
  it("blocks payment scheme mutation", () => expect(review(quote({ scheme: "upto" })).decision).toBe("BLOCK"));
  it("blocks noncanonical amount and negative amount", () => {
    for (const amount of ["0", "-1", "01", "1.5", "1e9"]) expect(review(quote({ amount })).decision).toBe("BLOCK");
  });
  it("blocks invalid EVM payTo", () => expect(review(quote({ payTo: "not-a-wallet" })).decision).toBe("BLOCK"));
  it("blocks absent and excessive timeout", () => {
    expect(review(quote({ maxTimeoutSeconds: undefined })).decision).toBe("BLOCK");
    expect(review(quote({ maxTimeoutSeconds: 7200 })).decision).toBe("BLOCK");
  });
  it("returns human REVIEW for two individually valid options", () => {
    const p = JSON.parse(quote()); p.accepts.push({ ...p.accepts[0] });
    expect(review(JSON.stringify(p)).decision).toBe("REVIEW");
  });
  it("returns REVIEW when seller resource URL absent", () => {
    const p = JSON.parse(quote()); delete p.resource;
    expect(review(JSON.stringify(p)).decision).toBe("REVIEW");
  });
  it("fails closed on unsupported v1", () => expect(() => review(JSON.stringify({ x402Version: 1, accepts: [] }))).toThrow("Only x402 v2"));
  it("fails closed on malformed JSON and empty options", () => {
    expect(() => review("!!!")).toThrow("valid x402 v2");
    expect(() => review(JSON.stringify({ x402Version: 2, accepts: [] }))).toThrow("Expected 1");
  });
  it("accepts at most six decimal digits for cap", () => {
    expect(parseUsdcLimit("0.000001")).toBe(1n);
    expect(() => parseUsdcLimit("0.0000001")).toThrow();
    expect(() => parseUsdcLimit("1e8")).toThrow();
    expect(() => parseUsdcLimit("-1")).toThrow();
  });
  it("correctly formats atomic units", () => {
    expect(formatMicro(1000001n)).toBe("1.000001");
    expect(formatMicro(1n)).toBe("0.000001");
  });
  it("rejects oversized quote and non-EVM expected recipient", () => {
    expect(() => reviewQuote({ quoteText: "a".repeat(20001), maxSpendUsdc: "1" })).toThrow("exceeds");
    expect(() => reviewQuote({ quoteText: quote(), maxSpendUsdc: "1", expectedRecipient: "bad" })).toThrow("Expected recipient");
  });
});
