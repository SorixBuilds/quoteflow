/**
 * Section-aware deep merge for Company Configuration (Phase 4, §5.5).
 *
 * Used on both config paths:
 *  - read: `deepMerge(DEFAULT_COMPANY_CONFIG, storedJson)` fills any missing key
 *    from defaults.
 *  - write: `deepMerge(currentConfig, partial)` merges a patch *within* each
 *    named section, leaving every untouched section intact — never a flat
 *    overwrite of the whole document.
 *
 * Plain objects merge recursively; arrays and primitives from `source` replace
 * the corresponding `target` value wholesale (config holds no arrays whose
 * element-wise merge would make sense). `undefined` values in `source` are
 * ignored so a sparse patch never clobbers an existing value with `undefined`.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function deepMerge<T>(target: T, source: unknown): T {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return (source === undefined ? target : (source as T));
  }

  const result: Record<string, unknown> = { ...target };

  for (const [key, sourceValue] of Object.entries(source)) {
    if (sourceValue === undefined) continue;
    const targetValue = result[key];
    result[key] =
      isPlainObject(targetValue) && isPlainObject(sourceValue)
        ? deepMerge(targetValue, sourceValue)
        : sourceValue;
  }

  return result as T;
}
