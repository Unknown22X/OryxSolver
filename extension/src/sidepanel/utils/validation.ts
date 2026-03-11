/**
 * Validates the email format and checks for common typos.
 */
export function validateEmailInput(rawEmail: string): { ok: boolean; message?: string } {
  const email = rawEmail.trim().toLowerCase();
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailRegex.test(email)) {
    return { ok: false, message: 'Please enter a valid email address.' };
  }

  const typoDomains = new Set([
    'gmai.com',
    'gmial.com',
    'gmail.co',
    'gmail.con',
    'hotnail.com',
    'outlok.com',
    'yaho.com',
    'outlouk.com',
    'gmale.com'
  ]);
  const domain = email.split('@')[1] ?? '';
  if (typoDomains.has(domain)) {
    return { ok: false, message: `Email domain looks wrong (${domain}). Please check it.` };
  }

  return { ok: true };
}
