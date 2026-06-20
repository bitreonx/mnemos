import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface SecurityAdvisory {
  name: string
  severity: 'low' | 'moderate' | 'high' | 'critical'
  title: string
  url?: string
  range?: string
}

export interface SecurityAuditResult {
  scannedAt: string
  root: string
  hasPackageJson: boolean
  npmAuditAvailable: boolean
  totalVulnerabilities: number
  critical: number
  high: number
  moderate: number
  low: number
  advisories: SecurityAdvisory[]
  onnxOptionalRisk: string
  recommendations: string[]
  score: number
}

function parseNpmAudit(stdout: string): SecurityAuditResult['advisories'] {
  try {
    const data = JSON.parse(stdout)
    const advisories: SecurityAdvisory[] = []
    const vulns = data.vulnerabilities ?? {}
    for (const [name, entry] of Object.entries(vulns as Record<string, Record<string, unknown>>)) {
      const via = entry.via
      if (!Array.isArray(via)) continue
      for (const v of via) {
        if (typeof v !== 'object' || v === null) continue
        const rec = v as { name?: string; severity?: string; title?: string; url?: string; range?: string }
        advisories.push({
          name: rec.name ?? name,
          severity: (rec.severity as SecurityAdvisory['severity']) ?? 'moderate',
          title: rec.title ?? 'Dependency vulnerability',
          url: rec.url,
          range: rec.range,
        })
      }
    }
    return advisories
  } catch {
    return []
  }
}

export async function auditRepositorySecurity(root: string): Promise<SecurityAuditResult> {
  const resolved = path.resolve(root)
  const pkgPath = path.join(resolved, 'package.json')
  const hasPackageJson = existsSync(pkgPath)

  const recommendations: string[] = []
  let advisories: SecurityAdvisory[] = []
  let npmAuditAvailable = false

  if (hasPackageJson) {
    const audit = spawnSync('npm', ['audit', '--json', '--omit=dev'], {
      cwd: resolved,
      encoding: 'utf-8',
      shell: process.platform === 'win32',
      timeout: 120_000,
    })
    npmAuditAvailable = audit.status === 0 || audit.stdout?.includes('vulnerabilities')
    if (audit.stdout) {
      advisories = parseNpmAudit(audit.stdout)
    }
    if (advisories.length > 0) {
      recommendations.push('Run npm audit fix in the project root, then rebuild Mnemos memory.')
    }
  } else {
    recommendations.push('No package.json — dependency audit skipped (non-Node repo).')
  }

  const critical = advisories.filter((a) => a.severity === 'critical').length
  const high = advisories.filter((a) => a.severity === 'high').length
  const moderate = advisories.filter((a) => a.severity === 'moderate').length
  const low = advisories.filter((a) => a.severity === 'low').length
  const total = advisories.length

  const onnxOptionalRisk =
    'Optional ONNX embeddings (@xenova/transformers) load only when installed. Default hash embeddings avoid protobuf/onnx transitive risk.'

  if (advisories.some((a) => a.name.includes('protobufjs'))) {
    recommendations.push(
      'protobufjs advisories often come from optional ML stacks — remove @xenova/transformers if you do not need ONNX embeddings.',
    )
  }

  if (critical > 0) {
    recommendations.push('Critical CVEs detected — patch before shipping to production.')
  }

  const penalty = critical * 25 + high * 12 + moderate * 5 + low * 2
  const score = Math.max(0, 100 - penalty)

  return {
    scannedAt: new Date().toISOString(),
    root: resolved,
    hasPackageJson,
    npmAuditAvailable,
    totalVulnerabilities: total,
    critical,
    high,
    moderate,
    low,
    advisories: advisories.slice(0, 40),
    onnxOptionalRisk,
    recommendations,
    score,
  }
}

export function formatSecurityAuditReport(result: SecurityAuditResult): string {
  const lines = [
    'Security Audit',
    '==============',
    '',
    `Score: ${result.score}/100`,
    `Critical: ${result.critical} · High: ${result.high} · Moderate: ${result.moderate} · Low: ${result.low}`,
    '',
  ]

  if (result.advisories.length === 0) {
    lines.push('No production dependency advisories reported by npm audit.')
  } else {
    lines.push('Top advisories:')
    for (const a of result.advisories.slice(0, 12)) {
      lines.push(`  • [${a.severity}] ${a.name}: ${a.title}`)
    }
  }

  lines.push('')
  lines.push(result.onnxOptionalRisk)
  if (result.recommendations.length > 0) {
    lines.push('')
    lines.push('Recommendations:')
    for (const r of result.recommendations) {
      lines.push(`  • ${r}`)
    }
  }

  return lines.join('\n')
}

export async function writeSecurityAuditReport(root: string, outputDir: string): Promise<string> {
  const result = await auditRepositorySecurity(root)
  const outPath = path.join(outputDir, 'security-audit.json')
  await mkdir(outputDir, { recursive: true })
  await writeFile(outPath, JSON.stringify(result, null, 2), 'utf-8')
  return outPath
}
