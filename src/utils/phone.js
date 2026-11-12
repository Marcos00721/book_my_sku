/** Keep the digits from a phone number without changing their length. */
export function stripPhoneFormatting(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Format partial input and pasted values as 123-456-7890 while typing.
 * Strips a leading US country code (+1 / 1) when present.
 */
export function formatNumber(value) {
  const raw = String(value ?? '');
  const rawDigits = stripPhoneFormatting(raw);
  const includesCountryCode =
    raw.trimStart().startsWith('+1') ||
    (rawDigits.length === 11 && rawDigits.startsWith('1'));
  const digits = (includesCountryCode ? rawDigits.slice(1) : rawDigits).slice(
    0,
    10,
  );

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** @deprecated Prefer formatNumber — kept for older call sites. */
export const formatUSPhoneNumber = formatNumber;

/** Validate the raw digits after removing display formatting. */
export const usPhoneRegex = /^\d{10}$/;
