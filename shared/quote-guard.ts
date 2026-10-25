/**
 * Untrusted x402 v2 quote preflight.
 * Offline-only: cannot approve, sign, settle, move funds or certify payment.
 * Use BigInt micro-units to avoid floating point payment drift.
 */
export const BASE_NATIVE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const BASE_CAIP2 = "eip155:8453";

export type Decision = "BLOCK" | "REVIEW" | "READY_FOR_HUMAN_REVIEW";
export type QuoteOption = {
  index: number; network: string; scheme: string;
  asset: string; payTo: string; amountMicro: string;
  amountUsdc: string; timeoutSeconds: number | null;
  issues: string[];
};
export type QuoteReview = {
  decision: Decision; interpretation: string; automaticPaymentAllowed: false;
  maxSpendUsdc: string; totalOptions: number; options: QuoteOption[];
  issues: string[]; checks: { label: string; pass: boolean }[];
  disclaimer: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function validAddress(s: string): boolean { return /^0x[0-9a-fA-F]{40}$/.test(s); }
export function formatMicro(amount: bigint): string {
  return (amount / 1_000_000n).toString() + "." + (amount % 1_000_000n).toString().padStart(6, "0");
}
export function parseUsdcLimit(text: string): bigint {
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(text)) {
    throw new Error("Spending cap must be a plain positive USDC decimal (up to six fractional digits).");
  }
  const [whole, fraction = ""] = text.split(".");
  const micro = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0") || "0");
  if (micro <= 0n || micro > 1_000_000_000n) {
    throw new Error("Spending cap must be greater than zero and no more than 1,000 USDC.");
  }
  return micro;
}

export function reviewQuote(input: {
  quoteText: string; maxSpendUsdc: string; expectedRecipient?: string;
}): QuoteReview {
  const max = parseUsdcLimit(input.maxSpendUsdc.trim());
  const quoteText = input.quoteText.trim();
  if (quoteText.length > 20000) throw new Error("Quote exceeds the 20,000-character limit.");
  if (input.expectedRecipient?.trim() && !validAddress(input.expectedRecipient.trim())) {
    throw new Error("Expected recipient must be a 0x-prefixed 20-byte public address.");
  }
  let payload: unknown;
  try { payload = JSON.parse(quoteText); }
  catch { throw new Error("Paste a valid x402 v2 PAYMENT-REQUIRED JSON object, not a wallet secret or raw signature."); }
  if (!isObject(payload)) throw new Error("Expected a JSON object.");
  if (payload.x402Version !== 2) throw new Error("Only x402 v2 quotes are supported; no automatic v1 fallback.");
  if (!Array.isArray(payload.accepts) || payload.accepts.length === 0 || payload.accepts.length > 10) {
    throw new Error("Expected 1–10 x402 v2 payment options in 'accepts'.");
  }
  const expectedRecipient = input.expectedRecipient?.trim().toLowerCase() || "";
  const options: QuoteOption[] = [];
  const issues: string[] = [];
  let mustBlock = false;

  for (const [index, raw] of payload.accepts.entries()) {
    const item = isObject(raw) ? raw : {};
    const network = typeof item.network === "string" ? item.network : "";
    const scheme = typeof item.scheme === "string" ? item.scheme : "";
    const asset = typeof item.asset === "string" ? item.asset : "";
    const payTo = typeof item.payTo === "string" ? item.payTo : "";
    const amount = typeof item.amount === "string" ? item.amount : "";
    const timeoutRaw = item.maxTimeoutSeconds;
    const timeoutSeconds = Number.isSafeInteger(timeoutRaw) && typeof timeoutRaw === "number"
      ? timeoutRaw : null;
    const findings: string[] = [];

    if (network !== BASE_CAIP2) findings.push("Unsupported network; only Base mainnet (eip155:8453) is allowed.");
    if (asset.toLowerCase() !== BASE_NATIVE_USDC) findings.push("Token is not official Base native Circle USDC.");
    if (scheme !== "exact") findings.push("Only exact-payment scheme is supported.");
    if (!validAddress(payTo)) findings.push("Invalid recipient wallet address.");
    else if (expectedRecipient && payTo.toLowerCase() !== expectedRecipient) findings.push("Recipient does not match the approved expected address.");
    if (!/^[1-9]\d{0,29}$/.test(amount)) findings.push("Atomic amount must be an unsigned canonical positive integer.");
    const atomic = /^[1-9]\d{0,29}$/.test(amount) ? BigInt(amount) : 0n;
    if (atomic > max) findings.push("Quote exceeds the locally selected spending cap.");
    if (timeoutSeconds === null || timeoutSeconds <= 0 || timeoutSeconds > 3600) findings.push("Timeout is missing or outside the supported 1–3,600 seconds.");
    if (findings.length) { mustBlock = true; issues.push(...findings.map(x => `Option ${index + 1}: ${x}`)); }
    options.push({
      index: index + 1, network, scheme, asset, payTo,
      amountMicro: amount, amountUsdc: formatMicro(atomic),
      timeoutSeconds, issues: findings
    });
  }
  if (options.length > 1) issues.push("Multiple payment options require explicit human selection; never silently choose one.");
  if (!isObject(payload.resource) || typeof payload.resource.url !== "string") {
    issues.push("The x402 v2 resource URL is absent or not a string; check the original seller independently.");
  }
  const hasBlocking = mustBlock;
  const decision: Decision = hasBlocking ? "BLOCK" :
    issues.length ? "REVIEW" : "READY_FOR_HUMAN_REVIEW";
  const checks = [
    { label: "x402 v2 JSON schema present", pass: true },
    { label: "Official Base chain and Circle USDC", pass: options.every(o => o.network === BASE_CAIP2 && o.asset.toLowerCase() === BASE_NATIVE_USDC) },
    { label: "Exact scheme and bounded integer cost", pass: options.every(o => o.scheme === "exact" && o.issues.length === 0) },
    { label: "Unambiguous seller and payment option", pass: options.length === 1 && isObject(payload.resource) && typeof payload.resource.url === "string" },
    { label: "No automatic signing or settlement", pass: true }
  ];
  return {
    decision,
    interpretation: decision === "BLOCK" ? "Quote fails local policy. Stop before connecting a wallet." :
      decision === "REVIEW" ? "Some details are ambiguous. Review independent seller terms." :
      "Syntactic quote and local payment-cap checks passed. Human wallet authorization is still required.",
    automaticPaymentAllowed: false,
    maxSpendUsdc: formatMicro(max),
    totalOptions: options.length,
    options, issues, checks,
    disclaimer: "This is a local offline payment-terms preflight, not an on-chain payment proof, investment recommendation, audit, or wallet authorization."
  };
}
