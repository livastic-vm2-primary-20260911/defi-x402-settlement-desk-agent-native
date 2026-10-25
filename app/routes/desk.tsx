import { useActionMutation } from "@agent-native/core/client/hooks";
import {
  IconArrowUpRight, IconBraces, IconCheck, IconCircleX,
  IconClipboardCheck, IconCode, IconDatabase, IconExternalLink,
  IconLock, IconRefresh, IconShieldCheck, IconWalletOff
} from "@tabler/icons-react";
import { useState } from "react";
import { BASE_NATIVE_USDC, type QuoteReview } from "../../shared/quote-guard";

const sampleReceiver = "0x1234567890123456789012345678901234567890";
function sampleQuote(amount = "10000"): string {
  return JSON.stringify({
    x402Version: 2,
    resource: { url: "https://example.org/payments/x402", description: "Synthetic public source analysis" },
    accepts: [{
      scheme: "exact", network: "eip155:8453",
      amount, asset: BASE_NATIVE_USDC,
      payTo: sampleReceiver, maxTimeoutSeconds: 300,
      extra: { name: "USD Coin", version: "2" }
    }]
  }, null, 2);
}
function PanelTitle({ index, title, help }: { index: string; title: string; help: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="font-mono text-[11px] text-slate-400 border border-slate-200 rounded px-2 py-1 shrink-0">{index}</span>
      <div>
        <h2 className="text-base font-semibold text-slate-950 leading-6">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{help}</p>
      </div>
    </div>
  );
}

export function meta() {
  return [
    { title: "DeFi Payment Desk — x402 v2 quote review" },
    { name: "description", content: "Inspect Base USDC x402 v2 payment terms offline before connecting a wallet. Agent and UI use the same typed guard action." },
  ];
}

export default function DeskRoute() {
  const [quote, setQuote] = useState(sampleQuote());
  const [cap, setCap] = useState("0.02");
  const [recipient, setRecipient] = useState(sampleReceiver);
  const [outcome, setOutcome] = useState<QuoteReview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const guard = useActionMutation("quote-guard");

  async function inspect() {
    setProblem(null);
    setOutcome(null);
    try {
      const response = await guard.mutateAsync({
        quoteText: quote,
        maxSpendUsdc: cap,
        expectedRecipient: recipient.trim() || undefined
      });
      setOutcome(response as QuoteReview);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "The quote could not be analyzed.");
    }
  }

  const decisionLabel = outcome?.decision === "BLOCK"
    ? "BLOCKED BY POLICY"
    : outcome?.decision === "REVIEW"
      ? "MANUAL REVIEW REQUIRED" : "LOCAL PREFLIGHT PASSED";

  return (
    <main className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-12 text-slate-900">
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-slate-950 text-white flex items-center justify-center">
            <IconShieldCheck size={23} stroke={1.6} />
          </div>
          <div>
            <div className="font-semibold tracking-tight">DeFi Payment Desk</div>
            <div className="text-[10px] text-slate-500 tracking-[0.12em] uppercase">By One Cursor · Agent-Native</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
          <span className="rounded-full border border-slate-200 px-3 py-1.5">Base mainnet</span>
          <span className="rounded-full border border-slate-200 px-3 py-1.5">Circle USDC</span>
          <span className="rounded-full border border-slate-200 px-3 py-1.5">x402 v2</span>
        </div>
      </div>

      <section className="py-10 md:py-14 grid lg:grid-cols-[1.6fr_1fr] gap-8 items-end">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.17em] text-slate-500 uppercase">
            <span className="w-5 h-px bg-slate-500" /> PRE-PAYMENT OPERATIONS
          </div>
          <h1 className="text-[clamp(2.5rem,5.3vw,4.8rem)] font-semibold tracking-[-0.065em] leading-[1.06] mt-5">
            Check the terms.<br /><span className="text-slate-400">Keep the keys.</span>
          </h1>
          <p className="mt-5 text-[15px] leading-7 text-slate-600 max-w-2xl">
            An agent-usable payment risk desk for x402 API buyers. Compare public HTTP 402 quotes against explicit USDC, recipient, chain and spend policies <strong>before</strong> any wallet action.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950 text-slate-100 p-6 min-h-[154px]">
          <div className="flex items-center gap-2 text-[11px] tracking-wider text-slate-400 uppercase">
            <IconLock size={17} /> Default security model
          </div>
          <div className="mt-4 text-2xl font-semibold">Zero wallet access</div>
          <p className="mt-2 text-[13px] text-slate-400 leading-6">
            Local-only quote inspection. No signing, sending, token approvals, seed phrases, wallet connection or simulated payouts.
          </p>
        </div>
      </section>

      <section className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-5 pb-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-[0_10px_40px_rgba(15,23,42,0.03)]">
          <PanelTitle index="01" title="Paste a merchant quote" help="Use a public x402 v2 PAYMENT-REQUIRED JSON body. Never paste API keys, signatures or wallet recovery data." />
          <div className="flex gap-2 my-5 flex-wrap">
            <button type="button" onClick={() => { setQuote(sampleQuote()); setRecipient(sampleReceiver); setOutcome(null); }}
              className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800">
              Load valid example
            </button>
            <button type="button" onClick={() => { setQuote(sampleQuote("30000")); setOutcome(null); }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50">
              Try over-cap example
            </button>
            <button type="button" onClick={() => { setQuote(""); setOutcome(null); setProblem(null); }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50 inline-flex items-center gap-1">
              <IconRefresh size={13} /> Clear
            </button>
          </div>
          <label htmlFor="payload" className="block text-xs font-semibold text-slate-700 mb-2">Quote payload</label>
          <textarea
            id="payload" spellCheck={false} aria-label="x402 v2 quote JSON"
            value={quote} onChange={e => setQuote(e.target.value)}
            className="w-full min-h-[310px] resize-y rounded-xl bg-slate-950 p-4 font-mono text-[12px] text-emerald-50 outline-none focus:ring-2 focus:ring-slate-400 leading-6"
          />
          <div className="grid sm:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)] gap-3 my-5">
            <div>
              <label htmlFor="cap" className="block text-xs font-semibold text-slate-700 mb-2">Max spend (USDC)</label>
              <input id="cap" type="text" inputMode="decimal" value={cap} onChange={e => setCap(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label htmlFor="recipient" className="block text-xs font-semibold text-slate-700 mb-2">Expected payTo (optional)</label>
              <input id="recipient" value={recipient} onChange={e => setRecipient(e.target.value)}
                spellCheck={false} className="w-full border border-slate-200 rounded-xl p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          </div>
          <button type="button" disabled={guard.isPending || !quote.trim()} onClick={() => void inspect()}
            className="w-full flex items-center justify-between rounded-xl bg-slate-950 text-white px-5 py-4 font-semibold disabled:opacity-40 hover:bg-slate-800">
            <span className="inline-flex items-center gap-2"><IconBraces size={19} /> {guard.isPending ? "Inspecting..." : "Review payment terms"}</span>
            <IconArrowUpRight size={19} />
          </button>
          <p className="text-xs text-slate-500 mt-3 text-center">No funds move. This action never sends the quote to a third-party LLM.</p>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 min-h-[338px]">
            <PanelTitle index="02" title="Policy decision" help="The same typed Agent-Native action powers this UI, the chat agent, API and MCP tools." />
            {problem && <div role="alert" className="mt-7 rounded-xl border border-red-200 bg-red-50 text-red-900 p-4 text-sm">{problem}</div>}
            {!outcome && !problem && (
              <div className="mt-8 h-[195px] rounded-xl border border-dashed border-slate-200 flex flex-col justify-center items-center text-center px-5">
                <IconClipboardCheck size={35} stroke={1.4} className="text-slate-300" />
                <div className="text-sm text-slate-700 font-semibold mt-4">No quote analyzed yet</div>
                <div className="text-xs text-slate-500 mt-2">Run the review to see a fact-based risk verdict.</div>
              </div>
            )}
            {outcome && (
              <div className="mt-6 space-y-5" aria-live="polite">
                <div className="rounded-xl bg-slate-950 text-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] tracking-[0.16em] uppercase text-slate-400">Decision</span>
                    {outcome.decision === "BLOCK" ? <IconCircleX size={19} /> : <IconCheck size={19} />}
                  </div>
                  <div className="text-xl font-semibold mt-3">{decisionLabel}</div>
                  <p className="mt-3 text-xs leading-6 text-slate-300">{outcome.interpretation}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-[11px] text-slate-500">Spend ceiling</div>
                    <div className="text-lg font-semibold mt-1">{outcome.maxSpendUsdc} <span className="text-xs">USDC</span></div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-[11px] text-slate-500">Payment options</div>
                    <div className="text-lg font-semibold mt-1">{outcome.totalOptions}</div>
                  </div>
                </div>
                {outcome.options.map(option => (
                  <div key={option.index} className="rounded-xl border border-slate-200 p-4 text-xs space-y-2">
                    <div className="font-semibold">Option {option.index}: {option.amountUsdc} USDC</div>
                    <div className="text-slate-500">Network: {option.network || "missing"}</div>
                    <div className="text-slate-500 font-mono break-all">payTo: {option.payTo || "missing"}</div>
                  </div>
                ))}
                <div className="space-y-2">
                  {outcome.checks.map(c => (
                    <div key={c.label} className="flex gap-2 items-center text-xs text-slate-600">
                      {c.pass ? <IconCheck size={15} className="text-emerald-700 shrink-0" /> : <IconCircleX size={15} className="text-red-700 shrink-0" />}
                      {c.label}
                    </div>
                  ))}
                </div>
                {outcome.issues.length > 0 && (
                  <ul className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-xs text-amber-950 space-y-2 list-disc list-inside">
                    {outcome.issues.map((issue, idx) => <li key={idx}>{issue}</li>)}
                  </ul>
                )}
                <p className="text-xs text-slate-500 leading-5">{outcome.disclaimer}</p>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 p-6">
            <div className="flex gap-2 items-center font-semibold text-sm"><IconWalletOff size={19} /> Never infer payment from a quote</div>
            <p className="text-[13px] leading-6 text-slate-600 mt-3">HTTP 402 is a price request, not a settlement receipt. An external, finalized on-chain transfer and independent payee match are required before booking revenue.</p>
            <div className="mt-5 text-[11px] text-slate-500 font-mono border-t border-slate-200 pt-4 break-words">
              chain: eip155:8453 · official USDC: {BASE_NATIVE_USDC}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 py-10">
        <div className="flex flex-wrap gap-5 items-start justify-between">
          <div>
            <p className="text-[11px] tracking-widest text-slate-500 uppercase">Built for safe agent commerce</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">One action, multiple surfaces.</h2>
            <p className="mt-3 text-sm text-slate-500 max-w-2xl leading-6">
              The policy engine runs identically for the browser reviewer, the autonomous agent and the public tool interface. No external quote validator, wallet custody or settlement side effects.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className="inline-flex gap-1.5 items-center px-4 py-3 rounded-xl bg-slate-950 text-white text-sm font-medium hover:bg-slate-800"
              href="mailto:onecursor1@gmail.com?subject=Paid%20x402%20integration%20review">
              Request paid integration <IconArrowUpRight size={17} />
            </a>
            <a className="inline-flex gap-1.5 items-center px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm font-medium"
              href="https://github.com/livastic-vm2-primary-20260911" target="_blank" rel="noreferrer">
              Source portfolio <IconExternalLink size={17} />
            </a>
          </div>
        </div>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {[
            { title: "Typed input", description: "Fail-closed v2 quote decoding with strict amount and address checks.", Icon: IconBraces },
            { title: "Economic controls", description: "Micro-USDC integer caps prevent decimal rounding and silent overpayment.", Icon: IconDatabase },
            { title: "Auditable tests", description: "Deterministic synthetic fixtures, no mainnet signing or wallet reliance.", Icon: IconCode }
          ].map(x => (
            <div key={x.title} className="rounded-xl border border-slate-200 p-5">
              <x.Icon size={23} stroke={1.5} className="text-slate-700" />
              <h3 className="font-semibold mt-4 text-sm">{x.title}</h3>
              <p className="text-xs leading-6 text-slate-500 mt-2">{x.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-[11px] text-slate-400">
          Deterministic preflight only. No investment advice, risk certification, live settlement, wallet connection, private-key handling or automatic spend.
        </p>
      </section>
    </main>
  );
}
