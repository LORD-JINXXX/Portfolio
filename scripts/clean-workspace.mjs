import { rm } from 'node:fs/promises'
import path from 'node:path'

for (const name of ['dist', 'build', '.turbo', 'coverage', 'tsconfig.tsbuildinfo']) {
  await rm(path.join(process.cwd(), name), { recursive: true, force: true })
}
console.log(`Cleaned ${process.cwd()}`)
