import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGraphsReferenceMarkdown,
  buildArchitectureReferenceMarkdown,
} from '../docs/reference.js';
import { buildLanguagesReferenceMarkdown } from '../languages/docs.js';
import { buildGraphsIndexMarkdown } from '../context/graph-markdown.js';
import { buildAgentsMd } from '../ai-toolkit.js';
import { SUPPORTED_LANGUAGE_COUNT } from '../languages/registry.js';

describe('documentation graphs', () => {
  it('buildLanguagesReferenceMarkdown includes pipeline and family diagrams', () => {
    const md = buildLanguagesReferenceMarkdown();
    assert.match(md, new RegExp(`${SUPPORTED_LANGUAGE_COUNT} programming languages`));
    assert.match(md, /```mermaid[\s\S]*flowchart TB/);
    assert.match(md, /Extractor routing/);
    assert.match(md, /mindmap/);
  });

  it('buildGraphsReferenceMarkdown catalogs all doc locations', () => {
    const md = buildGraphsReferenceMarkdown();
    assert.match(md, /docs\/GRAPHS\.md/);
    assert.match(md, /\.mnemos\/context\/graphs\.md/);
    assert.match(md, /```mermaid/);
    assert.ok((md.match(/```mermaid/g) ?? []).length >= 4);
  });

  it('buildArchitectureReferenceMarkdown includes system and language pipelines', () => {
    const md = buildArchitectureReferenceMarkdown();
    assert.match(md, /System pipeline/);
    assert.match(md, /context\/\*\.md/);
    assert.match(md, /LANGUAGES\.md/);
  });

  it('buildGraphsIndexMarkdown includes language and routing sections', () => {
    const md = buildGraphsIndexMarkdown({
      repository: 'x',
      builtAt: new Date().toISOString(),
      architecture: {
        name: 'x',
        type: 'App',
        summary: 's',
        layers: ['A'],
        packages: [],
        languages: { typescript: 1 },
      },
      domains: [],
      flows: [],
      services: [],
      apis: [],
      dependencies: [],
      criticalPaths: [],
      deadCode: [],
      smells: [],
      capabilities: [],
      journeys: [],
      stats: {
        filesScanned: 1,
        nodesCreated: 1,
        edgesCreated: 0,
        domainsFound: 0,
        flowsFound: 0,
        durationMs: 1,
      },
    });
    assert.match(md, /Extractor routing/);
    assert.match(md, /Language families/);
  });

  it('buildAgentsMd embeds domain, language, and pipeline graphs', () => {
    const md = buildAgentsMd(
      {
        repository: 'demo',
        builtAt: new Date().toISOString(),
        architecture: {
          name: 'demo',
          type: 'App',
          summary: 'Demo app',
          layers: ['API'],
          packages: [],
          languages: { typescript: 10, python: 2 },
        },
        domains: [],
        flows: [],
        services: [],
        apis: [],
        dependencies: [],
        criticalPaths: [],
        deadCode: [],
        smells: [],
        capabilities: [],
        journeys: [],
        stats: {
          filesScanned: 12,
          nodesCreated: 20,
          edgesCreated: 15,
          domainsFound: 0,
          flowsFound: 0,
          durationMs: 100,
        },
      },
      [],
      [],
    );
    assert.match(md, /```mermaid[\s\S]*flowchart LR/);
    assert.match(md, /Language distribution/);
    assert.match(md, /Extractor routing/);
    assert.match(md, /Language families/);
    assert.match(md, new RegExp(String(SUPPORTED_LANGUAGE_COUNT)));
    assert.match(md, /Agent Discipline/);
    assert.match(md, /Re-evaluate/);
  });
});
