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

## ADDITIONAL FINDINGS (exhaustive sweep)

### BUG-P — `setNodeUrl` is exported by the SDK but absent from the README
[VERIFIED-DOC/SDK · low] `node_modules/@terminal3/t3n-sdk/dist/index.d.ts:2946` declares `declare function setNodeUrl(url: string | null): void;` and the runtime export block at line 3188 lists `setNodeUrl` (`..., setEnvironment, setGlobalLogLevel, setNodeUrl, signAgentInvocation, ...`). `grep -c setNodeUrl node_modules/@terminal3/t3n-sdk/README.md` returns `0`. The README's Environments section documents `setEnvironment` and an explicit `baseUrl` on `new T3nClient(...)`, but never mentions `setNodeUrl`, which (per its own JSDoc at index.d.ts:2937-2946) clears the per-URL ML-KEM key cache and overrides the node URL per process. (Note: `getNodeUrl` is also absent — `grep -c getNodeUrl README.md` = 0 — so the only documented node-selection paths are `setEnvironment` / `baseUrl`.)
**Why it's a bug:** A public, exported function for per-process node-URL override + forced key-cache refresh is invisible to anyone reading the docs; it can only be discovered by reading the `.d.ts`.
**Fix:** Document `setNodeUrl(url | null)` (and `getNodeUrl()`) in the README Environments section, noting that passing `null` reverts to the environment default and that the call clears the cached ML-KEM public key.

### BUG-Q — `loadConfig` and `validateConfig` are exported but undocumented
[VERIFIED-DOC/SDK · low] `index.d.ts:2907` declares `declare function validateConfig(config: unknown): ConfigValidationResult;` and `index.d.ts:2981` declares `declare function loadConfig(baseUrl?: string): SdkConfig;`. Both appear in the runtime export block at line 3188 (`..., loadConfig, ...` and `..., validateConfig, ...`), and the supporting types `SdkConfig` (index.d.ts:2825) and `ConfigValidationResult` (index.d.ts:2836) are re-exported at line 3189. `grep -c loadConfig README.md` = 0 and `grep -c validateConfig README.md` = 0 against `node_modules/@terminal3/t3n-sdk/README.md`.
**Why it's a bug:** These config-loading/validation utilities are part of the published API surface but have no documented entry point, so docs-only developers cannot discover how to load or validate SDK configuration.
**Fix:** Add a Configuration subsection to the README: `loadConfig(baseUrl?)` loads SDK config from the node and returns an `SdkConfig`; `validateConfig(config)` validates a config object and returns a `ConfigValidationResult` before use.

### BUG-R — `TenantBaseClient` is a public, exported interface but is undocumented
[VERIFIED-DOC/SDK · low] `node_modules/@terminal3/t3n-sdk/dist/index.d.ts:2991-3000` defines `interface TenantBaseClient { execute(...): Promise<string>; executeWithBlob(...): Promise<string>; executeAndDecode?<T>(...): Promise<T>; getUsage?(...): Promise<UsagePage>; }`; it is the type of `TenantClientConfig.t3n` at line 3005 (`t3n?: TenantBaseClient;`) and is exported as a public type at line 3189 (appears in the `export type { ... }` block). `grep -n TenantBaseClient node_modules/@terminal3/t3n-sdk/README.md` returns no match (the README never mentions `TenantClient`, `TenantClientConfig`, or `TenantBaseClient` at all).
**Why it's a bug:** The JSDoc itself (index.d.ts:2985-2989) calls out mock-injection and control-plane-only clients as use cases, yet anyone building a custom or mock base client must reverse-engineer the required interface from the `.d.ts` because no documentation describes the contract a `T3nClient` must satisfy for `TenantClient`.
**Fix:** Document that `TenantClient` accepts an optional `t3n` that must satisfy `TenantBaseClient` (`execute`, `executeWithBlob`, optional `executeAndDecode`, optional `getUsage`); for the common path pass an authenticated `T3nClient`.

### BUG-S — `WriteDataInput` lets both `entryId` and `clientSeqNo` be undefined, though the JSDoc requires one (type-vs-doc divergence)
[VERIFIED-SDK · medium] `node_modules/@terminal3/t3n-sdk/dist/index.d.ts:2504-2511`:
```
interface WriteDataInput {
    orgDid: string;
    scope: string;
    payloadHex: string;
    /** Explicit entry ID (32 hex chars). When present, enables idempotent upsert. */
    entryId?: string;
    /** Client-supplied monotonic counter for ID derivation when `entryId` is absent. */
    clientSeqNo?: number;
}
```
The `writeData` JSDoc (index.d.ts:2627-2634) states: "When absent, `clientSeqNo` is required and the entry ID is derived via SHA-256 from `(org_did, scope, writer_did, client_seq_no)`." Both fields are typed optional, so `{ orgDid, scope, payloadHex }` (neither set) compiles, deferring the documented invariant to a runtime/server rejection. Same surface on `SessionOrgDataClient.writeData` (index.d.ts:2711).
**Why it's a bug:** The documented mutual requirement (one of `entryId`/`clientSeqNo`) is not encoded in the type, so a valid-looking call type-checks but fails at runtime.
**Fix:** Model it as a discriminated union (`{ entryId: string } | { clientSeqNo: number }`) so the compiler enforces "at least one present," or document precedence and validate at runtime with a typed error.

### BUG-T — Typo "withoutc" on the About Terminal 3 page
[VERIFIED-DOC · nit] `https://docs.terminal3.io/intro/about-t3`, under the National Digital ID section, renders verbatim: "...can be accepted at borders, airline check-ins, and public service access points **withoutc** physical document checks." (confirmed live; the string `withoutc` is present in the rendered page).
**Why it's a bug:** Misspelling of "without" (extraneous trailing `c`, no following space in source) on a public overview page; impacts readability/professionalism.
**Fix:** Change "withoutc" to "without" on the about-t3 page.

### BUG-U — The two OpenAPI spec URLs published in `llms.txt` both return HTTP 404 (dead links)
[VERIFIED-DOC/OPENAPI · medium] `https://docs.terminal3.io/llms.txt` lines 39-42 contain a dedicated section:
```
## OpenAPI Specs
- [terminal-3-openapi](https://docs.terminal3.io/terminal-3-openapi.yml)
- [openapi](https://docs.terminal3.io/api-reference/openapi.json)
```
Both linked URLs are dead: `curl -sIL https://docs.terminal3.io/terminal-3-openapi.yml` → `HTTP/2 404`, and `curl -sIL https://docs.terminal3.io/api-reference/openapi.json` → `HTTP/2 404` (no `Location` redirect; terminal 404, not a soft-404). (Distinct from BUG-01's doc-page 404 and from BUG-04's redirect; this is the machine-readable spec index.)
**Why it's a bug:** The official docs index advertises canonical OpenAPI spec files that do not resolve, breaking automated tooling (code generators, MCP/agent consumers that read `llms.txt`) that would consume the spec from these stable URLs.
**Fix:** Publish the OpenAPI YAML/JSON at the listed URLs, or remove/repoint the dead links in `llms.txt` (and mark "Coming soon" if not yet public).

### GAP-11 — `WriteDataInput.clientSeqNo` has no documented bounds
[VERIFIED-DOC · nit] `node_modules/@terminal3/t3n-sdk/dist/index.d.ts:2510-2511`: `/** Client-supplied monotonic counter for ID derivation when `entryId` is absent. */ clientSeqNo?: number;`. The one-line comment gives no min/max and does not state whether 0, negative, or non-integer values are valid; the only further context is the `writeData` JSDoc (index.d.ts:2631) that it feeds a SHA-256 entry-ID derivation.
**Why it's a gap:** "Monotonic counter" implies an ascending positive sequence, but the type and docs permit any `number`, with no stated valid range or worked example for callers.
**Fix:** Document the expected range (e.g., positive integer `> 0`, `< 2^53`) and note it is hashed into `SHA-256(org_did, scope, writer_did, client_seq_no)`; optionally add a validation helper.

### GAP-12 — `CreatePolicyInput.maxAdmins` is optional with no documented default or constraint
[VERIFIED-DOC · nit] `node_modules/@terminal3/t3n-sdk/dist/index.d.ts:2480-2483`:
```
interface CreatePolicyInput {
    orgDid: string;
    initialAdminDid: string;
    maxAdmins?: number;
}
```
None of the three fields carry JSDoc, and `maxAdmins?` has no inline comment. The `createPolicy` JSDoc never states what omitting `maxAdmins` does, nor any server default/floor/ceiling. The effective cap surfaces only later via the documented `OrgPolicyMeta.max_admins` (index.d.ts:718).
**Why it's a gap:** Callers cannot tell whether omitting `maxAdmins` inherits an org default or whether the server enforces a min/max, so policy construction relies on trial-and-error.
**Fix:** Add JSDoc stating the server default, the valid range, and the meaning of omission (e.g., "When omitted, the server applies its default cap").
