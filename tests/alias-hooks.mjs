import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = new URL('../', import.meta.url)

function withExtension(url) {
  const path = fileURLToPath(url)
  if (existsSync(path) && !path.endsWith('\\') && /\.[cm]?jsx?$/.test(path)) return url
  for (const ext of ['.js', '.jsx', '/index.js']) {
    if (existsSync(path + ext)) return pathToFileURL(path + ext).href
  }
  return url
}

/** Next.js'teki `@/` takma adını ve uzantısız göreli importları Node test ortamında çözer. */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return { url: withExtension(new URL(specifier.slice(2), root).href), shortCircuit: true }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const url = new URL(specifier, context.parentURL).href
    if (!/\.[cm]?jsx?$|\.json$/.test(specifier)) return { url: withExtension(url), shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
