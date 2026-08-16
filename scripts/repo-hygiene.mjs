import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const apply = process.argv.includes('--apply')
const check = process.argv.includes('--check')
const removableNames = new Set([
  'PATCH_README.md',
  'PATCH_MANIFEST.txt',
  'PATCH_MANIFEST.json',
  'PATCH_NOTES.md',
  'AI_AGE_PATCH_MANIFEST.txt',
  'CINEMATIC_TRANSITION_PATCH_MANIFEST.txt',
])
const reviewPatterns = [/_HANDOFF\.md$/i, /^EOD_.*\.md$/i, /^IMPLEMENTATION_.*\.md$/i, /^REPAIR_GROUP_STATUS\.md$/i]

const entries = await fs.readdir(root, { withFileTypes: true })
const removable = entries
  .filter((entry) => entry.isFile() && (entry.name.endsWith('.patch') || removableNames.has(entry.name)))
  .map((entry) => entry.name)
  .sort()
const review = entries
  .filter((entry) => entry.isFile() && reviewPatterns.some((pattern) => pattern.test(entry.name)))
  .map((entry) => entry.name)
  .sort()

if (removable.length) {
  console.log('Generated patch artifacts found at repository root:')
  for (const name of removable) console.log(`  - ${name}`)
  if (apply) {
    for (const name of removable) await fs.rm(path.join(root, name), { force: true })
    console.log(`Removed ${removable.length} generated patch artifact(s).`)
  } else {
    console.log('Run `npm run repo:hygiene:clean` to remove only these known generated artifacts.')
  }
} else {
  console.log('No generated root patch artifacts found.')
}

if (review.length) {
  console.log('\nHistorical/handoff documents left untouched for manual review:')
  for (const name of review) console.log(`  - ${name}`)
}

if (check && removable.length && !apply) process.exitCode = 1
