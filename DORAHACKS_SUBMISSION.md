# DoraHacks submission — paste-ready

## Project name
Terminal 3 Agent Mesh

## Tagline (one line)
An AI agent under hardware-enforced governance: it cannot overspend, cannot see the payment secret, and every action is audited — built on the Terminal 3 Agent Dev Kit.

## Short description (≈100 words)
Every "AI agent that can pay" demo has the same flaw: the agent sees the secrets and the only thing stopping it from overspending is a soft check a prompt-injection can defeat. Terminal 3 Agent Mesh fixes this with a TEE contract that enforces agent spending governance *inside the enclave*: per-transaction and cumulative caps checked in Rust, the payment secret read inside the enclave (the agent only ever gets a masked proof), the caller's identity taken from the host (unforgeable), and every decision written to an audited trail. It runs live on Terminal 3 testnet. This is T3's "AI Agent Governance" pitch, demonstrated.

## The problem it solves
Enterprises (banks, governments, institutions) won't let autonomous agents touch real money or data because the agent is a single point of total failure — it holds the credentials and its limits are unenforceable. That blocks the entire agentic economy. We move the trust boundary off the agent and into the TEE.

## What it does (demo)

**Headline — `npm run agent`:** a real autonomous **LLM agent** (brain = the Claude CLI) is told *"secure as much GPU compute as you can"* and is **not** told the spending caps. In a captured run it tried **$50,000** → denied (per-tx cap), probed down through $10k / $1k → denied, found **$100** → approved, then filled the budget with known-good $100 increments to exactly $300 — all governed **inside the TEE**, never seeing the payment secret. It tried to overspend, was **hardware-blocked**, and adapted into compliance. *(See `agent-report.png`.)*

**Scripted governance matrix — `npm run mesh:setup` then `npm run mesh:demo`:**
1. 3 in-budget purchases → APPROVED (cumulative spend tracked in-enclave).
2. Exceeds the cumulative budget → DENIED (over_total_budget).
3. A $9,999 over-cap buy → DENIED (over_per_tx_cap).
4. An unapproved caller → DENIED (buyer_not_approved; identity is host-stamped).
5. The audit trail (owner/auditor-gated) shows all six decisions.
6. Grep proves the raw payment secret appears in **zero** agent-visible output.

## Tech
- Terminal 3 ADK (`@terminal3/t3n-sdk`), Terminal 3 testnet TEE network.
- Seller contract: Rust → `wasm32-wasip2` WASM component, imports `host:interfaces/{kv-store,logging}` + `host:tenant/tenant-context`.
- TypeScript orchestrator (the buyer agent) + auto-logged dev harness.

## Honest scope (no over-claiming)
The live demo runs both roles under one funded testnet identity (self-governance) — making the buyer a separate identity is a config swap blocked only by non-transferable testnet credits (documented). The audit trail is contract-written/append-only; the owning tenant retains control-plane access. Full detail in `SUBMISSION.md`.

## Links
- **Demo video:** `agent-demo.mp4` (animated `agent-demo.gif`) — the autonomous agent vs governance, on testnet
- Code + writeup: `SUBMISSION.md`
- Demo report image: `agent-report.png` / `demo-report.png`
- Developer-experience findings (for the $200 track): `BUGS_AND_GAPS.md` (~40 bugs & doc gaps, many empirically verified against the live SDK)

## How to run
> Note: judges will likely **watch the demo video** rather than run it — reproducing requires a *funded* Terminal 3 testnet key (claim-gated) and the Rust→wasm toolchain. Full steps for the curious:
```bash
# 1. toolchain (+ the `claude` CLI on PATH, used as the agent's brain)
rustup target add wasm32-wasip2
npm install

# 2. credentials — claim a key at https://www.terminal3.io/claim-page, then:
echo 'T3N_API_KEY=0x<your-claimed-key>' > .env

# 3. build the contracts (target/ is gitignored, so build locally)
(cd contracts/mesh-seller && cargo build --target wasm32-wasip2 --release)
(cd contracts/smoke && cargo build --target wasm32-wasip2 --release)

# 4. run
npm run smoke        # proves register -> invoke
npm run mesh:setup   # register contract, create maps, seed policy + secret
npm run mesh:demo    # scripted governance matrix
npm run agent        # autonomous LLM agent vs governance (needs the `claude` CLI)
npm run report       # render demo-report.html
```
