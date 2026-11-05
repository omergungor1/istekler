function readPositiveInt(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function getImportLimits() {
  const maxFileMb = readPositiveInt('IMPORT_MAX_FILE_MB', 10)
  return {
    maxFileMb,
    maxFileBytes: maxFileMb * 1024 * 1024,
    maxRows: readPositiveInt('IMPORT_MAX_ROWS', 5000),
    maxFieldLength: 100_000,
  }
}
