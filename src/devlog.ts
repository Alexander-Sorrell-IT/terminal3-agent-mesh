/**
 * Auto-logger for the T3 build. Every script imports this so any error / doc-gap
 * we hit during development is captured to encountered-issues.jsonl with full
 * context. We later promote the real findings into BUGS_AND_GAPS.md ($200 track).
 *
 * It deliberately records the SDK's rich error fields (kind/detail/requestId).
 * Per recon BUG-G, the SDK often throws a bare Error that drops these — when a
 * field is missing here, THAT absence is itself a loggable bug.
 */
import { appendFileSync } from "fs";
import { join } from "path";

const LOG = join(process.cwd(), "encountered-issues.jsonl");

export type Severity = "bug" | "doc-gap" | "warning" | "info" | "success";

export function logIssue(entry: {
  area: string;
  severity: Severity;
  summary: string;
  error?: unknown;
  context?: Record<string, unknown>;
}) {
  const e = entry.error as any;
  const rec = {
    ts: new Date().toISOString(),
    area: entry.area,
    severity: entry.severity,
    summary: entry.summary,
    error: entry.error
      ? {
          name: e?.name,
          message: e?.message ?? String(entry.error),
          // rich SDK fields — null here often means the SDK swallowed them (a bug)
          kind: e?.kind ?? null,
          detail: e?.detail ?? null,
          requestId: e?.requestId ?? null,
          code: e?.code ?? null,
          stack: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 5).join("\n") : null,
        }
      : undefined,
    context: entry.context,
  };
  appendFileSync(LOG, JSON.stringify(rec) + "\n");
  const icon = { bug: "🐞", "doc-gap": "📄", warning: "⚠️", info: "ℹ️", success: "✅" }[entry.severity];
  console.error(`${icon} [${entry.severity}] ${entry.area} — ${entry.summary}`);
}

/** Wrap an async build step. Logs any throw with full context, then rethrows. */
export async function step<T>(area: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await fn();
    logIssue({ area, severity: "success", summary: `ok (${Date.now() - t0}ms)` });
    return out;
  } catch (err) {
    logIssue({ area, severity: "bug", summary: `threw during "${area}"`, error: err });
    throw err;
  }
}

/** Record a documentation gap (no exception involved). */
export const docGap = (area: string, summary: string, context?: Record<string, unknown>) =>
  logIssue({ area, severity: "doc-gap", summary, context });
