import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#171917",
          color: "#ffffff",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          fontSize: 46,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          letterSpacing: -3,
          position: "relative",
          width: "100%",
        }}
      >
        <span>SQ</span>
        <span
          style={{
            background: "#c7ff00",
            borderRadius: 999,
            bottom: 36,
            height: 11,
            position: "absolute",
            right: 36,
            width: 11,
          }}
        />
      </div>
    ),
    size,
  );
}
