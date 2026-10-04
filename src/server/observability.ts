import * as Sentry from "@sentry/node";

/**
 * ObservabilityService: thin wrapper over Sentry.
 *
 * Rules:
 *  - Observability must never break the product: every call is guarded.
 *  - Never attach family content (messages, transcripts, names) to spans or events.
 *    We record operation names, model ids, tool names, counts, durations and token usage.
 */

type Attr = string | number | boolean | undefined;
export type SpanAttributes = Record<string, Attr>;

function clean(attrs: SpanAttributes | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!attrs) return out;
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) out[k] = v;
  return out;
}

export interface SpanHandle {
  setAttributes(attrs: SpanAttributes): void;
}

const noopSpan: SpanHandle = { setAttributes: () => undefined };

export async function traceSpan<T>(
  opts: { name: string; op: string; attributes?: SpanAttributes },
  fn: (span: SpanHandle) => Promise<T>,
): Promise<T> {
  let started = false;
  try {
    return await Sentry.startSpan(
      { name: opts.name, op: opts.op, attributes: clean(opts.attributes) },
      async (span) => {
        started = true;
        const handle: SpanHandle = {
          setAttributes: (attrs) => {
            try {
              span.setAttributes(clean(attrs));
            } catch {
              /* ignore */
            }
          },
        };
        try {
          return await fn(handle);
        } catch (err) {
          try {
            span.setStatus({ code: 2, message: err instanceof Error ? err.name : "error" });
          } catch {
            /* ignore */
          }
          throw err;
        }
      },
    );
  } catch (err) {
    // If Sentry itself failed before running fn, still run the operation.
    if (!started) return fn(noopSpan);
    throw err;
  }
}

export function captureError(err: unknown, context: { area: string; tags?: Record<string, string> } ): void {
  try {
    const cause = err instanceof Error && err.cause ? err.cause : undefined;
    Sentry.withScope((scope) => {
      scope.setTag("kutumb.area", context.area);
      for (const [k, v] of Object.entries(context.tags ?? {})) scope.setTag(k, v);
      if (cause instanceof Error) scope.setContext("cause", { name: cause.name, message: cause.message.slice(0, 300) });
      Sentry.captureException(err);
    });
  } catch {
    /* observability must never throw */
  }
  if (process.env.NODE_ENV !== "test") {
    const name = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const cause = err instanceof Error && err.cause instanceof Error ? ` (cause: ${err.cause.name}: ${err.cause.message})` : "";
    console.error(`[kutumb:${context.area}] ${name}${cause}`.slice(0, 600));
  }
}

export function addBreadcrumb(category: string, message: string, data?: SpanAttributes): void {
  try {
    Sentry.addBreadcrumb({ category, message, data: clean(data), level: "info" });
  } catch {
    /* ignore */
  }
}
