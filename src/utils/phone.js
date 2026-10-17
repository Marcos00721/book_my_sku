/** Keep the digits from a phone number without changing their length. */
export function stripPhoneFormatting(value) {
  return value.replace(/\D/g, '');
}

/** Format partial input and pasted values as a US phone number. */
export function formatUSPhoneNumber(value) {
  const digits = stripPhoneFormatting(value).slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Validate the raw digits after removing display formatting. */
export const usPhoneRegex = /^\d{10}$/;
