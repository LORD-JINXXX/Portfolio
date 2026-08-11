import { rm, readdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const remove = async (target) => rm(target, { recursive: true, force: true })
const generatedNames = new Set(['dist', 'build', '.turbo', 'coverage'])

async function cleanWorkspace(parent) {
  let entries = []
  try { entries = await readdir(parent, { withFileTypes: true }) } catch { return }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const workspace = path.join(parent, entry.name)
    for (const generated of generatedNames) await remove(path.join(workspace, generated))
    await remove(path.join(workspace, 'tsconfig.tsbuildinfo'))
  }
}

for (const generated of generatedNames) await remove(path.join(root, generated))
await remove(path.join(root, 'tsconfig.tsbuildinfo'))
await cleanWorkspace(path.join(root, 'apps'))
await cleanWorkspace(path.join(root, 'packages'))

if (process.argv.includes('--all')) {
  await remove(path.join(root, 'node_modules'))
  for (const parent of ['apps', 'packages']) {
    let entries = []
    try { entries = await readdir(path.join(root, parent), { withFileTypes: true }) } catch { continue }
    for (const entry of entries) if (entry.isDirectory()) await remove(path.join(root, parent, entry.name, 'node_modules'))
  }
}

console.log(`Cleaned generated artifacts${process.argv.includes('--all') ? ' and node_modules' : ''}.`)
