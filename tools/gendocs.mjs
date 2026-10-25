// Generates docs/BIBLE.md, docs/GLOSSARY.md, docs/COURSE.md from the in-app learning data.
import { writeFileSync, mkdirSync } from 'node:fs';
const base = process.argv[2] || '../learn/';
const { GLOSSARY } = await import(new URL(base + 'glossary.js', import.meta.url));
const { BIBLE } = await import(new URL(base + 'bible.js', import.meta.url));
const { COURSE } = await import(new URL(base + 'course.js', import.meta.url));
const out = new URL('../docs/', import.meta.url); mkdirSync(out, { recursive: true });
const anchor = (t) => t.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');
writeFileSync(new URL('BIBLE.md', out), `# NEURALESE v5 — The Bible\n\nReference manual for every tab and control. Also in the app: TOOLS › LEARN › Bible.\n\n## Contents\n${BIBLE.map((b) => `- [${b.title}](#${anchor(b.title)})`).join('\n')}\n\n${BIBLE.map((b) => `## ${b.title}\n\n${b.body}\n`).join('\n')}`);
writeFileSync(new URL('GLOSSARY.md', out), `# Glossary (${GLOSSARY.length} terms)\n\n${GLOSSARY.map(([t, d, r]) => `### ${t}\n${d}${r.length ? `\n\n*See:* ${r.map((x) => `[${x}](#${anchor(x)})`).join(', ')}` : ''}\n`).join('\n')}`);
writeFileSync(new URL('COURSE.md', out), `# Course: TinyStories-8M from zero to interpretability research\n\n${COURSE.length} lessons, beginner → advanced. Each has a lecture, a diagram (in the app), a lab you run with the in-app terminal, and a quiz. Answers are at the end.\n\n${COURSE.map((l) => `## ${l.title}\n*${l.level} · ${l.minutes} min*\n\n${l.lecture}\n\n### Lab\n\`\`\`\n${l.lab.join('\n')}\n\`\`\`\n${l.labNotes}\n\n### Quiz\n${l.quiz.map((q, i) => `${i + 1}. ${q.q}\n${q.options.map((o, j) => `   ${'abc'[j]}) ${o}`).join('\n')}`).join('\n')}\n`).join('\n')}\n## Answer key\n\n${COURSE.map((l) => `- **${l.title}**: ${l.quiz.map((q, i) => `${i + 1}${'abc'[q.a]} — ${q.why}`).join('; ')}`).join('\n')}\n`);
console.log('docs written', GLOSSARY.length, BIBLE.length, COURSE.length);
