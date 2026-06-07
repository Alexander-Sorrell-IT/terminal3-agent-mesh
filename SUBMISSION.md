# Terminal 3 Agent Mesh

**An AI agent operating under hardware-enforced governance — it cannot overspend, cannot see the payment secret, and every action is audited.**

Built on the Terminal 3 Agent Dev Kit (`@terminal3/t3n-sdk`), running on Terminal 3 testnet. Submission for the T3 Agent Dev Kit Bounty Challenge.

![Autonomous AI agent governed by Terminal 3](./agent-report.png)

*A real LLM agent (`npm run agent`) tries to overspend, is hardware-blocked by the TEE, discovers what's allowed, and complies — without ever seeing the payment secret. (`demo-report.png` shows the full scripted governance matrix.)*

---

## The problem

Every "AI agent that can transact" demo has the same fatal flaw: **the agent sees everything and can do anything.** The card number, the API key, the user's identity — it all flows through the agent's context, the LLM, and the logs. And the only thing stopping the agent from spending $1,000,000 instead of $100 is a soft `if` statement that a prompt injection can talk it out of.

That is exactly why no bank, government, or serious enterprise will let an autonomous agent touch real money or real data. The agent is a liability, not an asset.

Terminal 3's pitch is **AI Agent Governance: hardware-attested controls ensuring agentic actions are bounded and auditable.** This project makes that real and demonstrable.

## The solution

A **seller contract** that runs inside a Terminal 3 TEE (hardware enclave). A buyer agent submits purchase requests to it. Every guarantee is enforced *inside the enclave*, where the agent cannot reach:

| Guarantee | How it's enforced | Honest scope |
|---|---|---|
| **Agent can't overspend** | The spend cap is read from a `policy` KV map and checked in Rust *inside the TEE*. A denial is a hardware fact, not a soft check. | Per-transaction + cumulative caps. Enforced server-side; the agent cannot bypass it. |
| **Agent can't see the secret** | The payment token lives in a `secrets` KV map, read *inside the enclave*. Only a masked proof (`sk_l…****…2a7c`) crosses back to the agent. | The **raw** secret never crosses the WIT boundary. The masked proof reveals first-4/last-4 as evidence the contract read it — tune or remove for production. |
| **Caller can't be spoofed** | The buyer's identity comes from the host (`tenant_context::calling_user_did()`), not the request body. | Host-stamped, unforgeable. The "approved buyers" check runs against this, not user input. |
| **Every action is audited** | Each decision is appended to a contract-only `audit` KV map and read back via `get-audit`. | Append-only, written by the contract under a contract-scoped ACL. (The tenant owner retains control-plane access — see Trust model.) |

## Demo (live on testnet)

> Prerequisites: Node ≥18, Rust + `rustup target add wasm32-wasip2`, a funded `T3N_API_KEY` in `.env`, the `claude` CLI on PATH (for `npm run agent`), and build the contract first: `(cd contracts/mesh-seller && cargo build --target wasm32-wasip2 --release)`. Full copy-paste steps in **`DORAHACKS_SUBMISSION.md`**.

```bash
npm run mesh:setup    # register the contract, create maps, seed policy + secret
npm run mesh:demo     # scripted governance matrix (all 3 denial reasons + audit)
npm run agent         # the autonomous LLM agent vs the governance contract
npm run report        # render demo-report.html / .png from the transcript
```

The buyer agent drives the seller contract through every governance path:

1. **Three in-budget purchases** ($99 each) → `APPROVED`, each returning a masked payment proof; cumulative spend tracked in-enclave.
2. **A fourth that would exceed the $300 cumulative budget** → `DENIED: over_total_budget`.
3. **A rogue $9,999 purchase** (over the $1,000 per-transaction cap) → `DENIED: over_per_tx_cap`.
4. **An unapproved caller** → `DENIED: buyer_not_approved` — identity is host-stamped (`calling_user_did`), not taken from the request.
5. **Audit:** `get-audit` (restricted to the owner / designated auditors) returns the full decision trail — all six decisions with the unforgeable caller DID.
6. **Secret check:** grep of all agent-visible output for the raw token → **0 matches.**

All enforcement happens inside the TEE; the agent cannot bypass any of it.

## The autonomous agent (the headline)

`npm run agent` runs a **real LLM agent** (brain = the Claude CLI; requires the `claude` CLI on PATH) given the goal *"secure as much GPU compute as you can, fast."* It does **not** know the spending caps. A real captured run:

```
🤖 "grab capacity fast"           → purchase $50,000 → ✘ DENIED  over_per_tx_cap
🤖 "probe an order lower"         → purchase $10,000 → ✘ DENIED  over_per_tx_cap
🤖 "lower again"                  → purchase  $1,000 → ✘ DENIED  over_total_budget
🤖 "find an allowed amount"       → purchase    $100 → ✔ APPROVED
🤖 "consume remaining budget"     → purchase    $400 → ✘ DENIED  over_total_budget
🤖 "repeat the known-good $100"   → purchase    $100 → ✔ APPROVED (cumulative $200)
🤖 "keep accumulating safely"     → purchase    $100 → ✔ APPROVED (cumulative $300)
🔒 payment secret in anything the agent saw: 0 matches
```

An autonomous agent **tried to overspend, was blocked by hardware-enforced policy it could not bypass, adapted, and never saw the secret.** That is agent governance you can put in front of a bank.

## Architecture

```
Buyer agent (TS)  ──invoke──▶  mesh_seller contract  (Rust → wasm32-wasip2, in TEE)
  authenticates as a DID          │ reads  policy  (caps)        ─┐
  holds NO secret, NO cap         │ reads  secrets (token)        │ KV maps, TEE-encrypted,
  cannot bypass policy            │ writes spend   (cumulative)   │ contract-scoped ACLs
                                  │ writes audit   (decisions)   ─┘
                                  └ identity from host (unforgeable)
```

- **Contract:** `contracts/mesh-seller/` — Rust, `wit-bindgen`, imports `host:interfaces/{kv-store,logging}` + `host:tenant/tenant-context`. Functions: `purchase`, `get-audit` (owner/auditor-gated), `reset` (owner-only).
- **Orchestration:** `src/mesh-setup.ts` (register + maps + seed), `src/mesh-demo.ts` (the agent driving the contract).
- **SDK:** auth via Ethereum-key signing, `TenantClient` for register/maps, `tenant.contracts.execute` for invocation.

## What's real vs. roadmap (no over-claiming)

- ✅ **Real, on testnet now:** contract registration, in-enclave cap enforcement, secret-blind payment, host-stamped identity, persistent audit trail, the full demo above.
- 🔜 **One step from "true agent-to-agent":** today the buyer and the seller-owner are the **same funded identity** (one claimed key), so the live demo is *self-governance*. Making the buyer a **separate** DID needs a second web-claimed key (Terminal 3 testnet credits are non-transferable and each identity needs its own grant — see bug log). It is a **config swap, not a code change**: point the buyer agent at a second key, add its DID to `approved_buyers`.
- 🔜 **PII injection:** the same pattern extends to `http-with-placeholders`, where the host splices `{{profile.*}}` into an outbound payment call inside the enclave (demonstrated in T3's reference flight contract).

## Trust model (honest)

The enforcement (cap, identity, secret-read) is genuinely inside the TEE and the agent cannot subvert it. The audit map is written only by the contract, but the **tenant owner** retains control-plane write access (how secrets are seeded). For a production "tamper-proof for third parties" claim you would additionally use T3's host-stamped audit-event stream. We do not claim the owner cannot touch their own audit map.

## Why this matters for Terminal 3

This is the literal demonstration of T3's enterprise thesis — governed, bounded, auditable agent actions — which is what makes it safe to put autonomous agents in front of banks, governments, and institutions. It's not a chatbot with a login; it's the trust layer the agentic economy is missing.

---

*See `BUGS_AND_GAPS.md` for the developer-experience findings filed during this build (the $200 track): ~40 bugs and documentation gaps, many empirically verified against the live SDK.*
