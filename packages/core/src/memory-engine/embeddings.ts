/**
 * Local embedding engine — deterministic feature hashing.
 * Runs 100% on-device with zero model downloads or network calls.
 *
 * Uses char n-grams + token hashing into a fixed 384-dim unit vector.
 * Quality: strong on code identifiers and architecture terms; upgrade path
 * to ONNX models remains optional via the same VectorIndex interface.
 */

import { tokenize } from '../search/index.js';
import { EMBEDDING_DIMS } from './types.js';

export { EMBEDDING_DIMS };

/** FNV-1a 32-bit hash — fast, deterministic, no deps. */
export function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function l2Normalize(vec: Float32Array): void {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i]! * vec[i]!;
  if (sum === 0) return;
  const inv = 1 / Math.sqrt(sum);
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i]! * inv;
}

/** Embed text into a unit vector — fully local, ~0.1ms per doc. */
export function embedLocal(text: string, dims = EMBEDDING_DIMS): Float32Array {
  const vec = new Float32Array(dims);
  const normalized = text.toLowerCase();

  // Char trigrams — captures code tokens like getUserById
  for (let i = 0; i < normalized.length - 2; i++) {
    const tri = normalized.slice(i, i + 3);
    const h = fnv1a(tri) % dims;
    vec[h]! += 1;
  }

  // Word tokens — architecture vocabulary
  for (const token of tokenize(text)) {
    const h = fnv1a(token) % dims;
    vec[h]! += 2;
    // Bigram tokens within identifiers (auth_service → auth, service)
    if (token.includes('_') || token.includes('-')) {
      for (const part of token.split(/[_-]+/)) {
        if (part.length > 2) {
          const ph = fnv1a(part) % dims;
          vec[ph]! += 1.5;
        }
      }
    }
  }

  l2Normalize(vec);
  return vec;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i]! * b[i]!;
  return dot;
}

export function serializeVector(vec: Float32Array): string {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength).toString('base64');
}

export function deserializeVector(b64: string, dims = EMBEDDING_DIMS): Float32Array {
  const buf = Buffer.from(b64, 'base64');
  const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  if (arr.length !== dims) {
    const fixed = new Float32Array(dims);
    fixed.set(arr.subarray(0, dims));
    return fixed;
  }
  return arr;
}
