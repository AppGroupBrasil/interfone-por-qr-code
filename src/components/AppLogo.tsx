import type { CSSProperties } from "react";

type AppLogoProps = {
  size?: number;
  alt?: string;
  rounded?: number;
  border?: string;
  background?: string;
  padding?: number;
  objectFit?: "contain" | "cover";
  style?: CSSProperties;
  className?: string;
};

export function AppLogo({
  size = 72,
  alt = "App Interfone",
  rounded = 18,
  border,
  background,
  padding = 0,
  objectFit = "contain",
  style,
  className,
}: AppLogoProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background,
        border,
        padding,
        ...style,
      }}
    >
      <img
        src="/logo.png"
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit }}
      />
    </div>
  );
}