export function buildQuery(filters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value && !(key === 'page' && value === 1)) params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
