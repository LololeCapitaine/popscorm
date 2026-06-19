import type { CSSProperties } from "react";

export function Icon({
  name,
  className,
  filled,
  size = 20,
  style,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={`material-symbols-rounded ${className ?? ""}`}
      style={{
        fontSize: size,
        fontVariationSettings: `"FILL" ${filled ? 1 : 0}, "wght" 400, "GRAD" 0, "opsz" ${size}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
