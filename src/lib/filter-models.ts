export function isInternalModel(id: string): boolean {
  return id.includes("internal") || id.startsWith("accounts/")
}

export function filterModels<T extends { id: string; owned_by?: string }>(
  models: Array<T>,
  hideInternal: boolean,
  vendorFilter?: string,
): Array<T> {
  let result = models
  if (hideInternal) {
    result = result.filter((m) => !isInternalModel(m.id))
  }
  if (vendorFilter) {
    const lower = vendorFilter.toLowerCase()
    result = result.filter(
      (m) => m.owned_by?.toLowerCase().includes(lower) ?? false,
    )
  }
  return result
}
