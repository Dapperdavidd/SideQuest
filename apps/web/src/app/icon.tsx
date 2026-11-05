import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#111111",
          color: "#ffffff",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          fontSize: 120,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          letterSpacing: -8,
          position: "relative",
          width: "100%",
        }}
      >
        <span>SQ</span>
        <span
          style={{
            background: "#e0fe5e",
            borderRadius: 999,
            bottom: 102,
            height: 30,
            position: "absolute",
            right: 104,
            width: 30,
          }}
        />
      </div>
    ),
    size,
  );
}
