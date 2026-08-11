import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

async function loadTypeScript() {
  try {
    const module = await import('typescript')
    return module.default ?? module
  } catch (packageError) {
    const globalCandidate = path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'typescript', 'lib', 'typescript.js')
    try {
      await access(globalCandidate)
      const module = await import(pathToFileURL(globalCandidate).href)
      return module.default ?? module
    } catch {
      throw new Error(`TypeScript is required for source linting. Run npm ci before linting. Original error: ${packageError instanceof Error ? packageError.message : String(packageError)}`)
    }
  }
}

const ts = await loadTypeScript()

const root = process.cwd()
const sourceRoots = ['apps', 'packages']
const extensions = new Set(['.ts', '.tsx'])
const failures = []

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (['node_modules', 'dist', 'build', '.turbo', 'coverage'].includes(entry.name)) continue
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(target))
    else if (extensions.has(path.extname(entry.name))) files.push(target)
  }
  return files
}

function lineOf(source, position) {
  return source.getLineAndCharacterOfPosition(position).line + 1
}

for (const sourceRoot of sourceRoots) {
  for (const file of await walk(path.join(root, sourceRoot))) {
    const text = await readFile(file, 'utf8')
    const relative = path.relative(root, file)
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    for (const diagnostic of source.parseDiagnostics) {
      failures.push(`${relative}:${lineOf(source, diagnostic.start ?? 0)} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
    }
    if (/dangerouslySetInnerHTML/.test(text)) failures.push(`${relative}: runtime source must not use dangerouslySetInnerHTML`)
    if (/\b(?:eval\s*\(|new\s+Function\s*\()/.test(text)) failures.push(`${relative}: eval/new Function is forbidden`)
    if (/^apps\/(?:admin|studio|web)\//.test(relative) && /SUPABASE_SERVICE_ROLE_KEY|service_role/i.test(text)) {
      failures.push(`${relative}: frontend source must not contain service-role credentials or role usage`)
    }
  }
}

if (failures.length) {
  console.error(`Source lint failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('Source lint passed: TypeScript/TSX parsed cleanly and production security source rules passed.')
