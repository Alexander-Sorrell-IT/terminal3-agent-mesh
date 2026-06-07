# Demo video — one-take shot list (~90 seconds)

Goal: judges watch this (they can't easily run it). Screen-record a terminal + the report image.

**Setup before recording:** big terminal font, `cd` into the project, key already in `.env`, run `npm run mesh:setup` once beforehand (don't record the setup).

### Shot 1 — the hook (10s, talking over a title card or the report)
"AI agents that can pay are a security nightmare — the agent sees the secrets and its spending limits are just soft checks. Terminal 3 moves that trust into a hardware enclave. Watch."

### Shot 2 — run the demo (40s) — record `npm run mesh:demo`
Narrate as the colored output scrolls:
- "Three purchases inside budget — approved. Notice `paid sk_l…****…2a7c` — that's a *masked* proof; the real token stayed in the enclave."
- "A fourth would blow the cumulative budget — **denied** by the contract, not the agent."
- "The agent goes rogue, tries a $9,999 buy over the per-transaction cap — **denied**."
- "An unapproved agent tries to buy — **denied**; identity is host-stamped, it can't be faked."
- "And the full audit trail — every decision, with the real caller."

### Shot 3 — the secret seal (10s)
Point at the last line: "We grep every byte the agent saw for the raw token — **zero matches**. It never left the enclave."

### Shot 4 — the report image (15s) — show `demo-report.png`
"Same run, rendered: three approvals, three different denial reasons, all enforced inside the TEE."

### Shot 5 — close (15s)
"This is Terminal 3's AI Agent Governance, working: an autonomous agent that *cannot* overspend, *cannot* see the secret, and is fully audited. That's what makes it safe to put an agent in front of a bank. Code and write-up in the repo."

---
Tip: if you do the LLM-agent upgrade, re-record Shot 2 showing the agent *reasoning out loud* before it tries the over-cap buy — that's the money shot.
