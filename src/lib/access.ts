import { createHmac, timingSafeEqual } from "node:crypto";

// Secret de signature des cookies d'accès aux modules privés.
// Utilise APP_SECRET si défini, sinon retombe sur le secret R2 (déjà présent
// côté serveur), sinon une valeur de dev. (Sécurité volontairement légère.)
function secret(): string {
  return (
    process.env.APP_SECRET ||
    process.env.R2_SECRET_ACCESS_KEY ||
    "popscorm-dev-secret"
  );
}

export function accessCookieName(shareId: string): string {
  return `pop_acc_${shareId}`;
}

export function accessToken(shareId: string): string {
  return createHmac("sha256", secret())
    .update(`access:${shareId}`)
    .digest("base64url");
}

export function verifyAccess(
  shareId: string,
  token: string | undefined | null,
): boolean {
  if (!token) return false;
  const expected = accessToken(shareId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
