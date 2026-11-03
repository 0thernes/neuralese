export const CHAPTERS: readonly { id: string; title: string; text: string }[];
export function chapterById(id: string): { id: string; title: string; text: string };
export function chapterOf(op: { id: string; kind?: string; weight?: string; layer?: number | null }): string;
export function titleOf(op: { id: string; kind?: string; weight?: string; layer?: number | null; head?: number | null }): string;
