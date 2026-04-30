import {
  Calendar,
  Edit3,
  LifeBuoy,
  Menu,
  Package,
  Rss,
  Users,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const FES_BLUE = "#0069a6";
const FES_TEAL = "#00b2a9";

const MENU_ITEMS: Array<{ label: string; Icon: LucideIcon }> = [
  { label: "News", Icon: Rss },
  { label: "Events", Icon: Calendar },
  { label: "Investigators", Icon: Users },
  { label: "Supporting Resources", Icon: LifeBuoy },
  { label: "Equipment Inventory", Icon: Package },
  { label: "Sign Up for Tuesdays!", Icon: Edit3 },
];

export function GlassDepth() {
  const rows = [
    [MENU_ITEMS[0]!, MENU_ITEMS[1]!],
    [MENU_ITEMS[2]!, MENU_ITEMS[3]!],
    [MENU_ITEMS[4]!, MENU_ITEMS[5]!],
  ];

  return (
    <div
      style={{
        width: 390,
        height: 844,
        background: "#f8f9fa",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Status-bar spacer */}
      <div style={{ height: 44 }} />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 20,
          paddingRight: 12,
          paddingBottom: 20,
          minHeight: 58,
        }}
      >
        <div style={{ width: 44 }} />
        <img
          src="/__mockup/images/fes-logo.png"
          alt="Cleveland FES"
          style={{ height: 50, objectFit: "contain", flex: 1 }}
        />
        <button
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            border: "none",
            background: "rgba(0,105,166,0.07)",
            cursor: "pointer",
          }}
        >
          <Menu size={24} color={FES_BLUE} strokeWidth={2} />
        </button>
      </div>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 4,
        }}
      >
        {rows.map((row, ri) => (
          <div
            key={ri}
            style={{ flex: 1, display: "flex", flexDirection: "row", gap: 14 }}
          >
            {row.map(({ label, Icon }) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  borderRadius: 18,
                  background: `linear-gradient(160deg, #00bfb5 0%, #009f9a 100%)`,
                  boxShadow:
                    "0 4px 16px rgba(0,105,166,0.18), inset 0 1px 0 rgba(255,255,255,0.28)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  cursor: "pointer",
                  padding: 16,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    background: "rgba(255,255,255,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={28} color="#ffffff" strokeWidth={1.75} />
                </div>
                <span
                  style={{
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    textAlign: "center",
                    lineHeight: 1.3,
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* CTA bar */}
      <div style={{ padding: "16px 20px 12px" }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${FES_BLUE} 0%, #0081c8 100%)`,
            borderRadius: 18,
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            boxShadow: "0 4px 16px rgba(0,105,166,0.25)",
          }}
        >
          <div style={{ flex: 1 }}>
            <p
              style={{
                color: "rgba(255,255,255,0.88)",
                fontSize: 12,
                margin: 0,
                marginBottom: 3,
                fontWeight: 400,
              }}
            >
              Interested in doing a project concept review?
            </p>
            <p
              style={{
                color: "#ffffff",
                fontSize: 15,
                margin: 0,
                fontWeight: 700,
                letterSpacing: "0.2px",
              }}
            >
              Contact Cheryl Dudek
            </p>
          </div>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Mail size={20} color="#ffffff" strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* Home indicator */}
      <div
        style={{
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 134,
            height: 5,
            borderRadius: 3,
            background: "rgba(0,0,0,0.18)",
          }}
        />
      </div>
    </div>
  );
}
