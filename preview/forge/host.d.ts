export function scriptedPrompt(task: string): string[];
export function greedyTokens(eng: unknown, tok: unknown, prompt: string, n: number): { tokens: string[]; note: string };
export function forwardOnce(eng: unknown, tok: unknown): { ms: number; width: number };
