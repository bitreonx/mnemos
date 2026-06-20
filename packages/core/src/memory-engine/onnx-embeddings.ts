/**
 * M4 — Optional ONNX embeddings via @xenova/transformers (100% local when installed).
 * Falls back to feature-hash embeddings when the optional package is absent.
 */

import { embedLocal, EMBEDDING_DIMS } from './embeddings.js';

export type EmbeddingMode = 'hash' | 'onnx' | 'auto';

let onnxPipeline: ((text: string) => Promise<Float32Array>) | null | undefined;

async function loadOnnxPipeline(): Promise<((text: string) => Promise<Float32Array>) | null> {
  if (onnxPipeline !== undefined) return onnxPipeline;
  try {
    // Optional peer — install @xenova/transformers manually for ONNX mode only
    const { pipeline } = await import('@xenova/transformers' as string) as {
      pipeline: (
        task: string,
        model: string,
        opts: { quantized: boolean },
      ) => Promise<(text: string, opts: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array }>>;
    };
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });
    onnxPipeline = async (text: string) => {
      const out = await extractor(text, { pooling: 'mean', normalize: true });
      const data = out.data as Float32Array;
      if (data.length === EMBEDDING_DIMS) return data;
      const resized = new Float32Array(EMBEDDING_DIMS);
      resized.set(data.subarray(0, EMBEDDING_DIMS));
      return resized;
    };
  } catch {
    onnxPipeline = null;
  }
  return onnxPipeline;
}

export async function embedDocument(
  text: string,
  mode: EmbeddingMode = 'auto',
): Promise<{ vector: Float32Array; backend: 'onnx' | 'hash' }> {
  if (mode === 'hash') {
    return { vector: embedLocal(text), backend: 'hash' };
  }
  const onnx = await loadOnnxPipeline();
  if ((mode === 'onnx' || mode === 'auto') && onnx) {
    return { vector: await onnx(text), backend: 'onnx' };
  }
  return { vector: embedLocal(text), backend: 'hash' };
}

export async function buildVectorIndexAsync(
  documents: Array<{ id: string; title: string; body: string; tags: string[] }>,
  mode: EmbeddingMode = 'auto',
): Promise<{ vectors: Map<string, Float32Array>; backend: 'onnx' | 'hash' }> {
  const vectors = new Map<string, Float32Array>();
  let backend: 'onnx' | 'hash' = 'hash';
  for (const d of documents) {
    const text = `${d.title}\n${d.body}\n${d.tags.join(' ')}`;
    const result = await embedDocument(text, mode);
    vectors.set(d.id, result.vector);
    if (result.backend === 'onnx') backend = 'onnx';
  }
  return { vectors, backend };
}

export async function isOnnxAvailable(): Promise<boolean> {
  return (await loadOnnxPipeline()) !== null;
}
