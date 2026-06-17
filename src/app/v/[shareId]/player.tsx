"use client";

import { useEffect, useState } from "react";

interface Props {
  shareId: string;
  title: string;
  version: string; // "1.2" | "2004"
  entryPath: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Lecteur SCORM. Installe scorm-again sur la fenêtre parente AVANT de charger
 * l'iframe (beaucoup de modules refusent de démarrer si l'API est absente).
 * Mode SANS persistance : aucune URL de commit n'est configurée, donc les
 * appels d'enregistrement restent en mémoire et sont jetés.
 */
export function Player({ shareId, title, version, entryPath }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const scorm = await import("scorm-again");
      if (cancelled) return;
      const w = window as any;
      const settings = { autocommit: false, logLevel: 5 } as any;
      if (version === "2004") {
        if (!w.API_1484_11) w.API_1484_11 = new scorm.Scorm2004API(settings);
      } else {
        if (!w.API) w.API = new scorm.Scorm12API(settings);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [version]);

  const src = `/content/${shareId}/${entryPath}`;

  return (
    <div className="flex h-dvh w-screen flex-col bg-black">
      {ready ? (
        <iframe
          src={src}
          title={title}
          className="h-full w-full border-0"
          allow="autoplay; fullscreen; microphone; camera"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-white/70">
          Chargement du module…
        </div>
      )}
    </div>
  );
}
