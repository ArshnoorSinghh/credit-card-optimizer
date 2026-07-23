import { ImageResponse } from "next/og";

/*
  Dynamically generated OpenGraph card (1200×630). No binary asset to check in —
  Satori renders this at build/request time. Kept to flexbox + hex colors (the
  Satori subset) and the system default font, so it needs no font fetch.
*/

export const alt = "Fils — Smarter UAE credit cards";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #f7f1e6 0%, #efe6d6 55%, #f2d9b8 100%)",
          color: "#2a2016",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "84px",
              height: "84px",
              borderRadius: "22px",
              background: "linear-gradient(135deg, #f4a63a, #e86f2c 45%, #c24e2c)",
              color: "#ffffff",
              fontSize: "52px",
              fontWeight: 700,
            }}
          >
            F
          </div>
          <div style={{ display: "flex", fontSize: "44px", fontWeight: 700 }}>Fils</div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", fontSize: "76px", fontWeight: 700, lineHeight: 1.05, maxWidth: "900px" }}>
            Stop leaving money on the table.
          </div>
          <div style={{ display: "flex", fontSize: "34px", color: "#6a5b47", maxWidth: "860px" }}>
            The best 1–3 UAE credit-card portfolio for how you spend — then how to
            spend the points you already hold.
          </div>
        </div>

        {/* Footer stat strip */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "28px", color: "#c24e2c", fontWeight: 600 }}>
          <div style={{ display: "flex" }}>53 UAE cards</div>
          <div style={{ display: "flex", color: "#7b6a51" }}>·</div>
          <div style={{ display: "flex" }}>12 banks</div>
          <div style={{ display: "flex", color: "#7b6a51" }}>·</div>
          <div style={{ display: "flex" }}>2 optimization engines</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
