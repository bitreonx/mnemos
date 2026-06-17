import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAgentDisciplineRules,
  buildDisciplineCursorRule,
  buildDisciplineSkillSection,
  buildDisciplineSkillMd,
  buildFableMindsetSkillMd,
  FABLE_DATASET_URL,
} from './agent-discipline.js'
import { loadFableMindsetMd } from './fable-mindset.js'

describe('agent discipline', () => {
  it('buildAgentDisciplineRules includes the decision loop', () => {
    const rules = buildAgentDisciplineRules().join('\n')
    assert.match(rules, /Agent Discipline/)
    assert.match(rules, /Ground/)
    assert.match(rules, /Re-evaluate/)
    assert.match(rules, /Verify/)
    assert.match(rules, /\.mnemos\/project\.dna\.json/)
  })

  it('buildDisciplineCursorRule has alwaysApply frontmatter', () => {
    const rule = buildDisciplineCursorRule()
    assert.match(rule, /alwaysApply: true/)
    assert.match(rule, /Fable-grade/)
  })

  it('buildDisciplineSkillSection points to mindset reference', () => {
    const section = buildDisciplineSkillSection()
    assert.match(section, /fable-mindset\.md/)
    assert.match(section, /fable_dataset_delta/)
  })

  it('buildDisciplineSkillMd is a full Claude Code skill', () => {
    const skill = buildDisciplineSkillMd()
    assert.match(skill, /Fable-grade/)
    assert.match(skill, /fable_dataset_delta/)
  })

  it('buildFableMindsetSkillMd is a self-contained skill with frontmatter', () => {
    const skill = buildFableMindsetSkillMd()
    assert.match(skill, /^---\nname: fable-mindset\n/)
    assert.match(skill, /description: .+/)
    assert.match(skill, /be cautious, then decisive/)
    assert.match(skill, /Re-evaluate/)
    // honesty guardrail: never claims a capability transplant
    assert.match(skill, /ports the habits, not the weights|does \*\*not\*\* make a model equal/)
  })

  it('FABLE_DATASET_URL is the Glint-Research dataset', () => {
    assert.match(FABLE_DATASET_URL, /Glint-Research\/Fable-5-traces/)
  })

  it('loadFableMindsetMd returns the full operating manual', async () => {
    const md = await loadFableMindsetMd()
    assert.match(md, /The Fable Mindset/)
    assert.match(md, /Appendix/)
    assert.match(md, /reasons on nearly every turn/)
  })
})
