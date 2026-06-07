# Terminal 3 ADK — Onboarding Bugs & Documentation Gaps

Submission for the **$200 "most detailed developer"** track of the T3 Agent Dev Kit Bounty Challenge (beta).
Reporter: broodierchip@gmail.com · Started: 2026-06-06

Each entry: what I expected → what happened → repro → suggested fix.

---

## BUGS / DEAD LINKS

### BUG-01 — Search-indexed developer docs URL 404s
- **Expected:** The developer guide overview to load.
- **Actual:** `https://docs.terminal3.io/t3n/developer-guide/developer-overview` returns **HTTP 404**. Content appears to have moved to `https://docs.terminal3.io/developers/adk/overview/what-is-adk` but the old path is still indexed by search engines and not redirected.
- **Repro:** `curl -sIL https://docs.terminal3.io/t3n/developer-guide/developer-overview` → `404`.
- **Fix:** Add a 301 redirect from the old path to the new ADK overview, or update the sitemap.

### BUG-02 — `payroll-agent.md` use-case page has no real content
- **Expected:** Use-case #15 "Payroll Agent" (listed in `llms.txt` docs index) to contain the payroll walkthrough.
- **Actual:** Page returns 200 but renders essentially empty — only a docs-index link plus a cross-reference fragment. The promised payroll content is missing.
- **Repro:** Open `https://docs.terminal3.io/developers/adk/use-cases/payroll-agent.md`.
- **Fix:** Populate the page, or have it redirect to the section that actually contains the payroll example.

### BUG-03 — Broken cross-reference + typo on Payroll page
- **Actual:** The Payroll page links to `t3n/use-cases/delegate-access-to-agent#payroll` with link text **"Delete Access to AI Agents"** — should be **"Delegate Access"** (typo: Delete→Delegate). Also verify the `#payroll` anchor actually exists on the target page.
- **Fix:** Correct link text to "Delegate Access to AI Agents" and confirm the anchor.

### BUG-04 — `network.terminal3.io` silently redirects to testnet
- **Expected:** The canonical network URL to resolve to itself or a clearly-labeled environment.
- **Actual:** `https://network.terminal3.io/` issues a **307 Temporary Redirect** to `https://testnet.network.terminal3.io/`. A new dev landing on the main URL has no signal they were bounced to testnet — risk of confusion between testnet vs production.
- **Fix:** Show an environment banner, or make the redirect explicit/permanent with labeling.

---

## HIGH-IMPACT FINDINGS (from running the SDK end-to-end)

### BUG-05 — The claim-page "API key / developer key" is undocumented to be an Ethereum private key
- **Severity:** High — blocks every new developer at the auth step.
- **What happens:** The claim page calls the secret a "developer key" / "API key" and implies a bearer credential. In reality it is the **secp256k1 Ethereum private key** that the SDK signs with. You must run `eth_get_address(key)` to derive your address and pass it through `metamask_sign(address, undefined, key)`. Nowhere in onboarding does it say the key is a signing private key.
- **Repro:** Take the claimed key, call `eth_get_address(key)` → valid address; `client.authenticate(createEthAuthInput(address))` succeeds. Treating it as a bearer/API token fails.
- **Impact:** A dev following the docs literally cannot authenticate, and may also not realize this secret has the security weight of a private key (the claim page should warn accordingly).
- **Fix:** Rename to "developer signing key (Ethereum private key)" on the claim page and show the derive-address + sign flow in the quickstart.

### BUG-06 — `set-up-dev-env` SDK snippet does not match the published `@terminal3/t3n-sdk@3.5.0` API
- The docs show: `setEnvironment("testnet")`, then `t3n.handshake()`, `t3n.authenticate(createEthAuthInput(address))` with an unexplained `t3n` object and no client construction.
- The actual published SDK requires: `loadWasmComponent()`, then `new T3nClient({ wasmComponent, handlers: { EthSign: metamask_sign(address, undefined, privateKey) } })` before `handshake()` / `authenticate()`.
- **Gap:** The docs omit `loadWasmComponent()`, the `T3nClient` constructor, the `handlers.EthSign` requirement, and `metamask_sign`/`eth_get_address` entirely. A dev cannot reproduce auth from the docs alone — only from the package README.
- **Fix:** Update the get-started walkthrough to the real v3.5.0 construction sequence.

### GAP-07 — No testnet node URL is published; `setEnvironment("testnet")` is the only way in
- The package README uses a placeholder `baseUrl: "https://t3n-node.example.com"`. No docs page lists the real testnet node URL. It works *only* because `setEnvironment("testnet")` injects a default baseUrl internally (minified, not documented). **Fix:** Document the testnet endpoint and that `setEnvironment` supplies it.

### GAP-08 — README install command uses `pnpm` but the rest of the docs assume `npm`
- Package README: `pnpm add @terminal3/t3n-sdk`. Dev-env docs: `npm install`. Pick one or show both. Minor but adds onboarding friction.

## DOCUMENTATION GAPS

### GAP-01 — Credential naming is inconsistent across onboarding
The same secret is called different things on consecutive pages:
- Claim page (`request-test-tokens`): **"developer key"**, "shown only once, can't be retrieved."
- Setup page (`set-up-dev-env`): lists **"DID, API key, test tokens"**.
- Register page: refers to an **"API key"**.
**Gap:** Is "developer key" == "API key"? A first-time dev cannot tell. **Fix:** Standardize on one term and define it once in a glossary.

### GAP-02 — Missing link from `T3nClient` to `tenant`/`TenantClient`
- `set-up-dev-env` shows auth via a `t3n` client: `t3n.handshake()`, `t3n.authenticate(...)`.
- `register-contract` and KV/ACL ops use a **`tenant`** object: `tenant.contracts.register(...)`, `tenant.maps.update(...)`.
**Gap:** No documented step shows how you obtain the `tenant` / `TenantClient` from the authenticated `t3n` / `T3nClient`. The onboarding chain is broken between auth and first contract registration. **Fix:** Add the bridging snippet (how to get a `TenantClient` after `authenticate()`).

### GAP-03 — `wasm-tools` install prerequisite not stated
`set-up-dev-env` runs `cargo install wasm-tools` but doesn't state that a working Rust/Cargo toolchain (rustup) and build essentials must already be present, nor expected versions. **Fix:** List rustup install + minimum Rust version.

### GAP-04 — `authorised_hosts` allowlist setup is referenced but never taught
`common-errors` lists `host/http.egress_denied: host '<host>' is not in the authorised_hosts allowlist` with fix "Add host to user's authorization grant" — but no get-started page documents *how* to create/edit that authorization grant. For any contract making outbound HTTP (the entire flight-booking example), this is a required step with no walkthrough. **Fix:** Add an "authorize outbound hosts" section to the walkthrough.

### GAP-05 — Claim-page URL not linked from the bounty/challenge page
The DoraHacks challenge says "head over to the tokens claim page" with no link; the real URL is `https://www.terminal3.io/claim-page` (found only via docs). **Fix:** Hyperlink it directly in the challenge description.

### GAP-06 — Campaign code requested but never provided to participants
The claim page has a "Campaign code (Optional)" field ("Enter hackathon, conference, or partner codes") that grants additional test tokens, but **the DoraHacks bounty challenge page never tells participants which code to use.** A bounty entrant has no documented way to know the correct code for this event (e.g. is it `SUPERAI2026`? a bounty-specific code?). **Fix:** State the campaign code explicitly in the challenge Details/Announcements.

---

## TODO — findings to add once I run the toolchain
- [ ] Does the claim page really show the key only once? (test)
- [ ] Does `npm install @terminal3/t3n-sdk` resolve on the public registry?
- [ ] Does `rustup target add wasm32-wasip2` + the sample `Cargo.toml` actually compile?
- [ ] End-to-end: register → invoke the flight-booking sample. Log every error hit.

---

## RECON-VERIFIED FINDINGS (deep SDK + docs audit, source-tagged)

These were found by reading the installed `@terminal3/t3n-sdk@3.5.0` type defs line-by-line and running empirical probes. Each cites where it was verified.

### BUG-A — `executeBusinessContract` signature is mis-shaped in every doc/example
Real signature (index.d.ts:3174): `executeBusinessContract<T>(session: TenantExecutionSession, options: ExecuteBusinessContractOptions<T>)` — **two args**. Docs/examples pass a single `{ tenant, contract, functionName, input }` object → type error, won't compile. **Fix:** document `(session, options)` arity and what `session` must be.

### BUG-B — `TenantClient` is undispatchable without `t3n`, yet `TenantClientConfig.t3n` is typed optional
(index.d.ts:3005) `new TenantClient({ environment, tenantDid })` yields an inert client; it dispatches through `config.t3n` (an authenticated `T3nClient`). **Fix:** make `t3n` required, or document it. Compounds GAP-02.

### BUG-C — `register()`/`publish()` return `Promise<unknown>`; numeric `contract_id` is doc-only
(index.d.ts:3112-3113) No response interface, so callers can't typed-extract the `contract_id` that map ACLs then require as a `number`. **Fix:** export `interface ContractRegisterResult { contract_id: number }` and type the methods.

### BUG-D — `WriterSet`/`ReaderSet` leak Rust serde casing
(index.d.ts:3029-3038) Both `{ only: number[] }` and `{ Only: number[] }` (and `"all"`/`"All"`) are valid; docs show only lowercase. **Fix:** normalize the union or document the casing leak.

### BUG-E — `MapCreateInput.readers` typed optional but runtime-required (deny-all if omitted)
(index.d.ts:3043) Type/runtime divergence — omitting `readers` silently denies all reads. **Fix:** make `readers` required or document the deny-all default.

### BUG-F — `agent-auth-update` mixes snake_case envelope with camelCase input, and has no SDK helper
(invoke-contract.md) Envelope is snake_case (`script_name`/`function_name`) but input is camelCase (`agentDid`/`scriptName`/`versionReq`/`allowedHosts`) — a footgun — with no typed helper, forcing raw `execute()` + hand-built JSON. **Fix:** add a typed `agentAuthUpdate()` helper; pick one casing. Extends GAP-04.

### BUG-G — typed-error contract not honored on HTTP-400
[EMPIRICAL] `submitUserInput` is documented `@throws {UserUpsertError}` (`kind:"EmailNotVerified"`), and `UserUpsertError.fromWire(...)` parses correctly — but the runtime 400 path throws a **generic `Error`** (`instanceof UserUpsertError === false`), with the JSON-RPC body merely stringified into `.message`. Callers lose `.kind`/`.detail`/`.requestId`. **Fix:** route 400s through `UserUpsertError.fromWire`/`RpcError`.

### BUG-H — testnet email OTP delivery non-functional; blocks the only documented bare-key admit path
[EMPIRICAL] `otpRequest({emailChannel})` failed **6/6** with `host/otp.verify: Email provider temporarily unavailable`; SMS is gated behind email (`Email must be verified before starting phone OTP verification`). The README happy path (`otpRequest → otpVerify → submitUserInput`) cannot complete on testnet, and it's the sole documented way to `becomeDevTenant` from a bare key. **Fix:** restore testnet email, or document an alternate gate-satisfier.

### BUG-J — `TenantClient` construction is undocumented and fails with sequential cryptic errors
[EMPIRICAL] Control ops (`tenant.me()`, `contracts.register`, etc.) require **all four** of `{ environment, t3n, tenantDid, baseUrl }`. With any missing, the client throws one-at-a-time: `requires tenantDid` → fix → `requires baseUrl` → fix. Nothing documents this; `TenantClientConfig` types every field optional. Working construction:
```ts
const tenant = new TenantClient({ environment: "testnet", t3n, tenantDid: didStr, baseUrl: getNodeUrl() });
```
**Fix:** document the required quartet, or validate all up front with one combined error.

### BUG-K (correction to BUG-C) — `register()` DOES return `{ name, contract_id }` at runtime
[EMPIRICAL] Despite the `Promise<unknown>` type, `contracts.register()` returns `{ name: "z:<tid>:<tail>", contract_id: <number> }` (observed `contract_id: 9`). This **resolves the recon's #1 risk** (numeric contract-id origin for map ACLs — it comes straight from the register response). Still a TYPE bug: should be `Promise<{ name: string; contract_id: number }>`.

### BUG-L — `claim()` / register / invoke are credit-gated at 10,000 with no documented funding path for new identities
[EMPIRICAL] A fresh ETH key (0 credits) gets `403 forbidden: InsufficientCredit (required=10000, available=0)` on both `tenant.claim()` and cross-tenant `executeAndDecode`. Credits come **only** from the web claim page. There is **no SDK method to transfer/mint/fund** credits (`transfer` appears only as a read-only `TokenTxKind`). So you cannot programmatically stand up a second funded tenant — every participating identity must be web-claimed separately. **Fix:** document the credit model + minimum balances, and provide a faucet or transfer API for multi-agent/testing scenarios.

### GAP-09 — the 10,000 credit "reservation" reads as a per-op cost but is ~1 credit actual; undocumented + misleading
[EMPIRICAL] Measured: one contract invoke charges **1 credit** (balance 18,617 → 18,616). Yet failed ops report `InsufficientCredit (required=10000)`, which strongly implies a 10k *cost*. The 10,000 is a refundable minimum-balance **reservation**, not a charge — but nothing documents this, so a developer reasonably believes they can only do ~1-2 operations. **Fix:** document the reservation-vs-charge model and surface the actual fuel cost; make the error say "minimum balance 10000 required (reservation, refunded)".

### BUG-M — `token.getUsage().entries` returns empty despite `version:5` and a changing balance
[EMPIRICAL] The balance moves (charges happen) and `balance.version` increments, but `entries: []` — the per-caller ledger feed never populates, so you can't audit what was charged or why. **Fix:** populate the usage feed, or document that testnet doesn't.

### KEY FINDING (not a bug) — credits are non-transferable + per-identity 10k floor blocks multi-agent dev
Each identity needs its own ≥10,000 balance to act, and there is no transfer/mint API (BUG-L). So building a multi-agent app with multiple *funded* identities requires a separate web claim per identity. This is the real friction for the "agent mesh" use case — not credit quantity (~18.6k is plenty for one identity's work).

### BUG-N — re-registering a contract (version bump) assigns a NEW `contract_id`, silently orphaning map ACLs
[EMPIRICAL] Each `register` of the same tail at a higher version returns a different `contract_id` (observed 10→11→12→13→14). Map ACLs scoped `{ only: [oldId] }` then fail with `403 access denied: TenantContract(.../<newId>) cannot write map "..."`. Nothing warns you; a working app breaks on the next deploy. **Fix:** keep a stable contract id across versions of the same tail, or document that you must re-point every map ACL after each (re)registration.

### BUG-O — `maps.delete` is async with no completion signal, and re-using the same tail is blocked indefinitely
[EMPIRICAL] `tenant.maps.delete(tail)` returns success immediately, but the map then sits in a `Deleting` state for >50s (never observed to clear in our runs). During that window the tail is unusable: `maps.create(tail)` → `already exists`, `maps.update(tail)` → `400 map is already in Deleting state`. There is no API to query deletion progress or to force completion, so a caller cannot reliably recreate a map under the same tail. **Fix:** make delete synchronous, or expose a deletion-status field and a way to recreate a tail once deletion settles. (Recommended pattern instead: clear map *entries* from within the contract — deletion of the map object itself is best avoided.)

### GAP-10 — contract-scoped map ACLs do not gate the tenant control plane (undocumented, security-relevant)
`writers/readers: { only: [contractId] }` gate **contract-time** access but NOT the tenant control plane: `executeControl("map-entry-set", …)` writes any "contract-only" map (the repo relies on this to seed secrets). So a "contract-only" audit map is still owner-writable via the control plane — meaning it is **not** tamper-proof against the owner. This asymmetry is load-bearing and nowhere documented. **Fix:** state that contract-scoped ACLs ≠ control-plane ACLs, and offer a host-stamped append-only audit primitive for third-party-verifiable trails.

### BUG-I (doc) — `host-api.md` + outbound-http tip omit the actual API surface
[VERIFIED-DOC] host-api.md is prose only (no WIT world, no `kv-store`/`logging::audit` signatures); the exact `logging::audit` signature exists nowhere in docs or SDK. **Fix:** publish the WIT worlds + host-call signatures on host-api.md.
