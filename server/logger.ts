import { IS_PROD } from "./config.js";

type Level = "debug" | "info" | "warn" | "error";

function fmt(level: Level, scope: string, msg: string, extra?: unknown) {
  const ts = new Date().toISOString();
  if (IS_PROD) {
    const payload: Record<string, unknown> = { ts, level, scope, msg };
    if (extra !== undefined) payload.extra = extra;
    return JSON.stringify(payload);
  }
  const tag = `[${scope}]`;
  return extra === undefined ? `${ts} ${level.toUpperCase()} ${tag} ${msg}` : `${ts} ${level.toUpperCase()} ${tag} ${msg} ${typeof extra === "string" ? extra : JSON.stringify(extra)}`;
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, extra?: unknown) => { if (!IS_PROD) console.log(fmt("debug", scope, msg, extra)); },
    info: (msg: string, extra?: unknown) => console.log(fmt("info", scope, msg, extra)),
    warn: (msg: string, extra?: unknown) => console.warn(fmt("warn", scope, msg, extra)),
    error: (msg: string, extra?: unknown) => console.error(fmt("error", scope, msg, extra)),
  };
}

export const log = createLogger("app");
