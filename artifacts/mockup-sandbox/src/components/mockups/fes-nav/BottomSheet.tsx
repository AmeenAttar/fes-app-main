import React from "react";
import {
  Home,
  Rss,
  Calendar,
  Users,
  LifeBuoy,
  Package,
  Pencil,
  ChevronRight,
  ExternalLink,
  Mail,
  Menu
} from "lucide-react";

export function BottomSheet() {
  const navItems = [
    { icon: Home, label: "Home" },
    { icon: Rss, label: "News", external: true },
    { icon: Calendar, label: "Events" },
    { icon: Users, label: "Investigators" },
    { icon: LifeBuoy, label: "Supporting Resources" },
    { icon: Package, label: "Equipment Inventory" },
    { icon: Pencil, label: "Sign Up for Tuesdays!" },
  ];

  return (
    <div
      className="relative mx-auto overflow-hidden bg-[#f3f4f6]"
      style={{
        width: "390px",
        height: "844px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Background App Screen (Simplified Home Menu) */}
      <div className="absolute inset-0 flex flex-col pt-14 px-4">
        <div className="flex justify-between items-center mb-8">
          <img
            src="/__mockup/images/fes-logo.png"
            alt="FES Logo"
            className="h-10 object-contain"
            onError={(e) => {
              // Fallback if logo not found
              e.currentTarget.style.display = 'none';
            }}
          />
          <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
            <Menu size={20} color="#1f2937" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-2xl shadow-sm"
              style={{
                height: "120px",
                background: "linear-gradient(160deg, #00bfb5, #009f9a)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Scrim Overlay */}
      <div className="absolute inset-0 bg-black/35 z-10" />

      {/* Bottom Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white z-20 flex flex-col"
        style={{
          height: "65%",
          borderRadius: "28px 28px 0 0",
          padding: "20px 20px 32px 20px",
        }}
      >
        {/* Handle */}
        <div
          className="mx-auto rounded-full bg-[#d1d5db] mb-3"
          style={{ width: "36px", height: "4px" }}
        />

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto mt-2 hide-scrollbar">
          <div className="flex flex-col">
            {navItems.map((item, index) => (
              <div key={item.label}>
                <button className="w-full flex items-center gap-3.5 h-[44px] group">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors"
                    style={{ background: "rgba(0,178,169,0.10)" }}
                  >
                    <item.icon size={20} color="#00b2a9" />
                  </div>
                  <span className="flex-1 text-left text-[16px] font-semibold text-[#1f2937]">
                    {item.label}
                  </span>
                  {item.external ? (
                    <ExternalLink size={16} color="#9ca3af" className="shrink-0" />
                  ) : (
                    <ChevronRight size={16} color="#9ca3af" className="shrink-0" />
                  )}
                </button>
                {/* Separator, but not after the first item, and not after the last item */}
                {index > 0 && index < navItems.length - 1 && (
                  <div className="h-[1px] bg-[#f3f4f6] ml-[54px] my-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Button */}
        <button
          className="w-full mt-4 flex items-center justify-center gap-2 shadow-sm transition-opacity active:opacity-80 shrink-0"
          style={{
            background: "#0069a6",
            borderRadius: "14px",
            height: "52px",
          }}
        >
          <Mail size={18} color="white" />
          <span className="text-white text-[15px] font-bold">
            Contact Cheryl Dudek
          </span>
        </button>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

export default BottomSheet;
