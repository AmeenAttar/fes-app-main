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

export function LayeredMaterial() {
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
        background: "#ffffff",
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
          paddingLeft: 18,
          paddingRight: 10,
          paddingBottom: 18,
          minHeight: 58,
        }}
      >
        <div style={{ width: 40 }} />
        <img
          src="/__mockup/images/fes-logo.png"
          alt="Cleveland FES"
          style={{ height: 46, objectFit: "contain", flex: 1 }}
        />
        <button
          style={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            border: `1.5px solid rgba(0,105,166,0.15)`,
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <Menu size={22} color={FES_BLUE} strokeWidth={2} />
        </button>
      </div>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingLeft: 18,
          paddingRight: 18,
        }}
      >
        {rows.map((row, ri) => (
          <div
            key={ri}
            style={{ flex: 1, display: "flex", flexDirection: "row", gap: 12 }}
          >
            {row.map(({ label, Icon }) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  borderRadius: 16,
                  background: FES_TEAL,
                  border: "1px solid rgba(255,255,255,0.35)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "space-between",
                  overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,178,169,0.20)",
                }}
              >
                {/* Icon zone */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={32} color="#ffffff" strokeWidth={1.75} />
                </div>

                {/* Label zone — bottom band */}
                <div
                  style={{
                    width: "100%",
                    paddingTop: 10,
                    paddingBottom: 14,
                    paddingLeft: 8,
                    paddingRight: 8,
                    borderTop: "1px solid rgba(255,255,255,0.22)",
                    background: "rgba(0,0,0,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.8px",
                      textTransform: "uppercase",
                      textAlign: "center",
                      lineHeight: 1.25,
                    }}
                  >
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* CTA bar */}
      <div style={{ padding: "14px 18px 10px" }}>
        <div
          style={{
            background: FES_BLUE,
            borderRadius: 14,
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Mail size={20} color="rgba(255,255,255,0.85)" strokeWidth={2} />
          <div style={{ flex: 1 }}>
            <p
              style={{
                color: "rgba(255,255,255,0.80)",
                fontSize: 11,
                margin: 0,
                marginBottom: 2,
                fontWeight: 400,
                letterSpacing: "0.2px",
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
              }}
            >
              Contact Cheryl Dudek
            </p>
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
            background: "rgba(0,0,0,0.15)",
          }}
        />
      </div>
    </div>
  );
}
