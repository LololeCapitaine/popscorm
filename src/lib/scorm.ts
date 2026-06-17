import { XMLParser } from "fast-xml-parser";

export type ScormVersion = "1.2" | "2004";

export interface ScormInfo {
  version: ScormVersion;
  /** Chemin du fichier de lancement, relatif au dossier du manifeste. */
  entryPath: string;
  title: string;
  /** Dossier du manifeste dans le zip ("" si à la racine). */
  manifestDir: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true, // adlcp:scormType -> scormType, etc.
  trimValues: true,
});

/* eslint-disable @typescript-eslint/no-explicit-any */

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in v) return String(v["#text"] ?? "");
  return "";
}

/** Localise le imsmanifest.xml (préfère le plus proche de la racine). */
export function detectManifestPath(paths: string[]): string | null {
  const candidates = paths
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => p.toLowerCase().endsWith("imsmanifest.xml"));
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) => a.split("/").length - b.split("/").length || a.length - b.length,
  );
  return candidates[0];
}

/** Analyse le contenu d'un imsmanifest.xml. */
export function parseManifest(xml: string): {
  version: ScormVersion;
  entryHref: string;
  title: string;
} {
  const doc = parser.parse(xml);
  const manifest = doc.manifest;
  if (!manifest) {
    throw new Error("imsmanifest.xml invalide : élément <manifest> introuvable.");
  }

  // --- Version SCORM ---
  const schemaversion = textOf(manifest.metadata?.schemaversion).toLowerCase();
  const haystack = JSON.stringify(manifest).toLowerCase();
  let version: ScormVersion;
  if (
    schemaversion.includes("2004") ||
    schemaversion.includes("cam 1.3") ||
    /adlcp_v1p3|adlcp_rootv1p3|imscp_v1p1|adlseq|adlnav/.test(haystack)
  ) {
    version = "2004";
  } else {
    // par défaut 1.2 (schemaversion "1.2" ou namespace adlcp_rootv1p2)
    version = "1.2";
  }

  // --- Ressources : identifier -> resource ---
  const resources = asArray(manifest.resources?.resource);
  const resMap = new Map<string, any>();
  for (const r of resources) {
    const id = r?.["@_identifier"];
    if (id) resMap.set(String(id), r);
  }

  // --- Organisation par défaut -> premier item avec identifierref ---
  const organizations = manifest.organizations;
  const defaultOrgId = organizations?.["@_default"];
  const orgs = asArray(organizations?.organization);
  const org =
    orgs.find((o) => String(o?.["@_identifier"]) === String(defaultOrgId)) ??
    orgs[0];

  let title = "";
  let entryHref = "";

  if (org) {
    title = textOf(org.title);
    const findItem = (items: any[]): any => {
      for (const it of items) {
        if (it?.["@_identifierref"]) return it;
        const found = findItem(asArray(it?.item));
        if (found) return found;
      }
      return null;
    };
    const item = findItem(asArray(org.item));
    if (item) {
      if (!title) title = textOf(item.title);
      const res = resMap.get(String(item["@_identifierref"]));
      if (res) entryHref = textOf(res["@_href"]);
    }
  }

  // Repli : première ressource possédant un href
  if (!entryHref) {
    const withHref = resources.find((r) => r?.["@_href"]);
    if (withHref) entryHref = textOf(withHref["@_href"]);
  }

  if (!entryHref) {
    throw new Error(
      "Impossible de déterminer le fichier de lancement (aucun href de ressource).",
    );
  }

  return { version, entryHref, title };
}

/**
 * Analyse complète d'un paquet : à partir de la liste des chemins du zip et du
 * contenu du manifeste, renvoie la version, le fichier de lancement (relatif au
 * dossier du manifeste) et le titre.
 */
export function analyzeScorm(
  paths: string[],
  manifestXml: string,
  manifestPath: string,
): ScormInfo {
  const dir = manifestPath.includes("/")
    ? manifestPath.slice(0, manifestPath.lastIndexOf("/") + 1)
    : "";
  const { version, entryHref, title } = parseManifest(manifestXml);
  const entryPath = entryHref
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "") // retire ./ ou / initial
    .trim();
  return { version, entryPath, title, manifestDir: dir };
}
