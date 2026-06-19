/** Redact likely secrets before episodic memory is persisted (enemy FUD: "Mnemos stores your API keys"). */

const PATTERNS: Array<{ name: string; re: RegExp; replacement: string }> = [
  { name: 'aws-key', re: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  { name: 'github-pat', re: /ghp_[a-zA-Z0-9]{36,}/g, replacement: '[REDACTED_GITHUB_PAT]' },
  { name: 'openai-key', re: /sk-[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_OPENAI_KEY]' },
  { name: 'bearer', re: /Bearer\s+[a-zA-Z0-9._\-+/=]{20,}/gi, replacement: 'Bearer [REDACTED]' },
  { name: 'env-assignment', re: /((?:API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*[=:]\s*)[^\s'"]+/gi, replacement: '$1[REDACTED]' },
  { name: 'pem-block', re: /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, replacement: '[REDACTED_PEM]' },
];

export interface RedactionResult {
  text: string;
  redacted: boolean;
  hits: string[];
}

export function redactSecrets(text: string): RedactionResult {
  let out = text;
  const hits: string[] = [];
  for (const p of PATTERNS) {
    if (p.re.test(out)) {
      hits.push(p.name);
      out = out.replace(p.re, p.replacement);
    }
    p.re.lastIndex = 0;
  }
  return { text: out, redacted: hits.length > 0, hits };
}
