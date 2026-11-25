export interface CountryOption {
  code: string;
  name: string;
}

const ISO_COUNTRY_CODES = [
  'AR', 'AT', 'AU', 'BE', 'BO', 'BR', 'CA', 'CH', 'CL', 'CN',
  'CO', 'CR', 'CU', 'CZ', 'DE', 'DO', 'EC', 'ES', 'FR', 'GT',
  'HN', 'IE', 'IT', 'JP', 'KR', 'MX', 'NI', 'NL', 'NO', 'PA',
  'PE', 'PL', 'PT', 'PY', 'RU', 'SE', 'SV', 'UK', 'US', 'UY',
  'VE',
] as const;

const COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  UK: 'Reino Unido',
};

const regionNames =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['es'], { type: 'region' })
    : null;

export function getCountryName(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (COUNTRY_NAME_OVERRIDES[normalized]) {
    return COUNTRY_NAME_OVERRIDES[normalized];
  }
  if (/^[A-Z]{2}$/.test(normalized) && regionNames) {
    try {
      return regionNames.of(normalized) || normalized;
    } catch {
      return normalized;
    }
  }
  return normalized;
}

export function formatCountryLabel(code: string): string {
  const normalized = code.trim().toUpperCase();
  const name = getCountryName(normalized);
  return name !== normalized ? `${normalized} — ${name}` : normalized;
}

export function getAllCountryOptions(extraCode?: string): CountryOption[] {
  const codeSet = new Set<string>(ISO_COUNTRY_CODES);
  if (extraCode?.trim()) {
    codeSet.add(extraCode.trim().toUpperCase());
  }

  return Array.from(codeSet)
    .map((code) => ({
      code,
      name: getCountryName(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
