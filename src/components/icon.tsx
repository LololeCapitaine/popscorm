import type { CSSProperties } from "react";

export function Icon({
  name,
  className,
  filled,
  style,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`material-symbols-rounded ${className ?? ""}`}
      style={{
        ...(filled ? { fontVariationSettings: '"FILL" 1' } : {}),
        ...style,
      }}
    >
      {name}
    </span>
  );
}
