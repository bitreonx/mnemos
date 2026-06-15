#!/usr/bin/env node
/** Prepare anonymized blind-eval reports for a repository */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(__dirname, '..');
const repoId = process.argv[2] ?? 'express';
const sessionId = randomBytes(4).toString('hex');
const sessionDir = path.join(__dirname, 'sessions', `${repoId}-${sessionId}`);

const variants = [
  { tool: 'mnemos', src: path.join(BENCH, 'repos', repoId, '.mnemos', 'project.dna.json') },
  { tool: 'gitingest', src: path.join(BENCH, 'results', `${repoId}-gitingest.txt`) },
  { tool: 'graphify', src: path.join(BENCH, 'repos', repoId, 'lib', 'graphify-out', 'graph.json') },
];

const labels = ['A', 'B', 'C'];
const order = labels.sort(() => Math.random() - 0.5);

await mkdir(sessionDir, { recursive: true });
const key = {};

for (let i = 0; i < variants.length; i++) {
  const label = order[i];
  const v = variants[i];
  const ext = v.src.endsWith('.json') ? 'json' : v.src.endsWith('.html') ? 'html' : 'txt';
  const dest = path.join(sessionDir, `report-${label}.${ext}`);
  try {
    let content = await readFile(v.src, 'utf-8');
    content = content.replace(/mnemos|graphify|gitingest/gi, 'REDACTED');
    await writeFile(dest, content);
    key[label] = v.tool;
  } catch {
    await writeFile(path.join(sessionDir, `report-${label}.missing`), `Source not found: ${v.src}`);
    key[label] = `${v.tool} (missing)`;
  }
}

await writeFile(path.join(sessionDir, 'KEY.json'), JSON.stringify(key, null, 2));
await writeFile(
  path.join(sessionDir, 'questionnaire.md'),
  `# Blind eval session ${sessionId}\n\nReports: ${order.map((l) => `report-${l}`).join(', ')}\n\n1. Which report helped you understand fastest?\n2. Which would you give to an AI agent first?\n3. Minutes until you could explain architecture to a teammate?\n`,
);
console.log(`Session: ${sessionDir}`);
console.log(`Key (keep private):`, key);
