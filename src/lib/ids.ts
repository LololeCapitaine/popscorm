import { randomBytes } from "node:crypto";

/** Jeton public aléatoire et non devinable (~16 caractères URL-safe). */
export function generateShareId(): string {
  return randomBytes(12).toString("base64url");
}

/**
 * Valide qu'un chemin relatif issu du zip est sûr (pas d'échappement de
 * répertoire, pas de chemin absolu).
 */
export function isSafeRelPath(p: string): boolean {
  if (!p || p.length > 1024) return false;
  if (p.startsWith("/") || p.includes("\\")) return false;
  if (p.split("/").some((seg) => seg === "..")) return false;
  return true;
}
