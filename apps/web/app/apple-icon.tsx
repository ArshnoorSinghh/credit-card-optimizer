import { ImageResponse } from "next/og";

/*
  Apple touch icon (180×180), generated to match the flame "F" tile. No binary
  asset needed — rendered via Satori, flexbox + hex only.
*/

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f4a63a, #e86f2c 45%, #c24e2c)",
          color: "#ffffff",
          fontSize: "116px",
          fontWeight: 700,
        }}
      >
        F
      </div>
    ),
    { ...size },
  );
}
