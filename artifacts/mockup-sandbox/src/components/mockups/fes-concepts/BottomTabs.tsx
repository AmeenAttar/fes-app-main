import React, { useState } from "react";
import { Home, Calendar, Users, LifeBuoy, LayoutGrid, ArrowRight, Rss, Package, Pencil, ChevronRight } from "lucide-react";

export function BottomTabs() {
  const [activeTab, setActiveTab] = useState("Home");

  return (
    <div
      className="relative bg-gray-50 flex flex-col overflow-hidden text-[#1f2937]"
      style={{
        width: 390,
        height: 844,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-center h-[88px] bg-white border-b border-gray-100 shadow-sm z-10 pt-10 shrink-0">
        <img
          src="/__mockup/images/fes-logo.png"
          alt="FES Center"
          style={{ height: 32, objectFit: "contain" }}
        />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-[#f9fafb] pb-[104px]">
        <div className="px-5 py-6 space-y-8">
          
          {/* Section 1: This Week */}
          <section>
            <h2 className="text-[#00b2a9] text-xs font-bold tracking-wider uppercase mb-3 px-1">
              This Week
            </h2>
            <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden relative flex flex-col">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#00b2a9]" />
              <div className="p-4 pl-5">
                <div className="text-xs font-semibold text-gray-500 mb-1">
                  Tue May 6 • 9:00 AM
                </div>
                <h3 className="text-[17px] font-bold text-[#1f2937] leading-tight mb-3">
                  Investigator Roundtable
                </h3>
                <button className="flex items-center text-sm font-semibold text-[#00b2a9] group">
                  View Details <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </section>

          {/* Section 2: Latest News */}
          <section>
            <h2 className="text-[#00b2a9] text-xs font-bold tracking-wider uppercase mb-3 px-1">
              Latest News
            </h2>
            <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] p-4 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <img
                  src="/__mockup/images/fes-logo.png"
                  alt="FES"
                  className="w-5 h-5 object-contain"
                />
                <span className="text-xs font-medium text-gray-400">News Update</span>
              </div>
              <h3 className="text-[16px] font-bold text-[#1f2937] leading-snug mb-2">
                FES Center Announces New Equipment Grant
              </h3>
              <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed mb-3">
                The center has secured funding for next-generation neurostimulation devices available to all affiliated researchers starting next month.
              </p>
              <button className="flex items-center text-sm font-semibold text-[#00b2a9] group mt-auto">
                Read Article <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </section>

          {/* Section 3: Quick Links */}
          <section>
            <h2 className="text-[#00b2a9] text-xs font-bold tracking-wider uppercase mb-3 px-1">
              Quick Links
            </h2>
            <div className="flex overflow-x-auto pb-4 -mx-5 px-5 gap-3 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <button className="whitespace-nowrap bg-[#00b2a9] text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm hover:bg-[#009f9a] transition-colors active:scale-95">
                Equipment Inventory
              </button>
              <button className="whitespace-nowrap bg-[#00b2a9] text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm hover:bg-[#009f9a] transition-colors active:scale-95">
                Sign Up for Tuesdays!
              </button>
              <button className="whitespace-nowrap bg-[#00b2a9] text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm hover:bg-[#009f9a] transition-colors active:scale-95">
                Cheryl Dudek ✉
              </button>
            </div>
          </section>

        </div>
      </main>

      {/* Tab Bar (Fixed Bottom) */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-[84px] pb-5 px-2 flex justify-between items-center z-20">
        <TabItem
          icon={<Home />}
          label="Home"
          isActive={activeTab === "Home"}
          onClick={() => setActiveTab("Home")}
        />
        <TabItem
          icon={<Calendar />}
          label="Events"
          isActive={activeTab === "Events"}
          onClick={() => setActiveTab("Events")}
        />
        <TabItem
          icon={<Users />}
          label="Investigators"
          isActive={activeTab === "Investigators"}
          onClick={() => setActiveTab("Investigators")}
        />
        <TabItem
          icon={<LifeBuoy />}
          label="Resources"
          isActive={activeTab === "Resources"}
          onClick={() => setActiveTab("Resources")}
        />
        <TabItem
          icon={<LayoutGrid />}
          label="More"
          isActive={activeTab === "More"}
          onClick={() => setActiveTab("More")}
        />
      </nav>
      
      {/* Global styles for hiding scrollbar in Quick Links */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </div>
  );
}

function TabItem({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full h-full gap-1 pt-1 ${
        isActive ? "text-[#00b2a9]" : "text-[#9ca3af]"
      }`}
    >
      <div className={`w-6 h-6 flex items-center justify-center ${isActive ? "[&>svg]:fill-[#00b2a9]" : ""}`}>
        {React.cloneElement(icon as React.ReactElement, {
          strokeWidth: isActive ? 2.5 : 2,
          className: "w-6 h-6",
        })}
      </div>
      <span className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}>
        {label}
      </span>
    </button>
  );
}
