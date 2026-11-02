export const HELP: string;
export function openRun(source: string, opts?: { lmTokens?: string[]; seed?: number }): unknown;
export function reproBundle(run: unknown, extra?: { lanes?: unknown }): Promise<object>;
export function runLanes(): unknown;
