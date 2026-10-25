import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { reviewQuote } from "../shared/quote-guard";

/**
 * The agent, HTTP, MCP and human React UI all use this exact same action.
 * No network requests, credential reads, wallet interactions or writes.
 */
export default defineAction({
  description: "Inspect an untrusted x402 v2 PAYMENT-REQUIRED JSON quote locally; block wrong asset, recipient, chain, price cap or ambiguous spend. Never sign or pay.",
  mcpTool: true,
  readOnly: true,
  schema: z.object({
    quoteText: z.string().min(1).max(20000).describe("Public x402 v2 JSON quote (no secrets)"),
    maxSpendUsdc: z.string().default("0.02").describe("Maximum reviewable USDC payment, e.g. 0.02"),
    expectedRecipient: z.string().optional().describe("Optional pre-approved public seller address")
  }),
  run: async (args) => reviewQuote(args)
});
