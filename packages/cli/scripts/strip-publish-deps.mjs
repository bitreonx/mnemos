#!/usr/bin/env node
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgPath = path.join(__dirname, '..', 'package.json')
const backupPath = path.join(__dirname, '..', 'package.json.publish-backup')

export function backupPackageJson() {
  copyFileSync(pkgPath, backupPath)
}

export function stripWorkspaceDeps() {
  if (!existsSync(backupPath)) backupPackageJson()
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  pkg.dependencies = {}
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  console.log('[publish] cleared workspace dependencies for npm tarball')
}

export function restorePackageJson() {
  if (!existsSync(backupPath)) return
  copyFileSync(backupPath, pkgPath)
  console.log('[publish] restored package.json from backup')
}

const cmd = process.argv[2]
if (cmd === 'strip') stripWorkspaceDeps()
if (cmd === 'restore') restorePackageJson()
