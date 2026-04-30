import React from "react";
import { Rss, Calendar, Users, LifeBuoy, Package, Pencil, Mail, Bell, ArrowRight } from "lucide-react";

export function Dashboard() {
  return (
    <div
      className="relative mx-auto overflow-hidden bg-[#f8f9fa] shadow-2xl"
      style={{
        width: "390px",
        height: "844px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-14 pb-4 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100">
        <img
          src="/__mockup/images/fes-logo.png"
          alt="FES Center"
          className="h-10 object-contain"
        />
        <div className="flex items-center gap-4">
          <button className="relative text-gray-500 hover:text-gray-900 transition-colors">
            <Bell size={24} />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="w-10 h-10 rounded-full bg-[#0069a6] flex items-center justify-center text-white font-semibold shadow-sm">
            FI
          </div>
        </div>
      </header>

      <main className="px-5 py-6 flex flex-col gap-8 pb-24 h-full overflow-y-auto">
        
        {/* Hero Card */}
        <div
          className="relative rounded-[16px] p-6 text-white shadow-lg overflow-hidden flex flex-col justify-between"
          style={{
            background: "linear-gradient(135deg, #00bfb5 0%, #009f9a 100%)",
            minHeight: "220px"
          }}
        >
          {/* Top Row: Label & Icon */}
          <div className="flex justify-between items-start mb-4">
            <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase backdrop-blur-sm">
              Next Event
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Calendar size={20} className="text-white" />
            </div>
          </div>

          {/* Content */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold leading-tight mb-2">
              Monthly Investigator Roundtable
            </h2>
            <p className="text-teal-50 font-medium">Tuesday, May 6 · 9:00 AM</p>
          </div>

          {/* Bottom Row */}
          <div className="flex justify-end">
            <button className="bg-white text-[#009f9a] px-6 py-2 rounded-full font-semibold text-sm shadow-sm hover:bg-gray-50 transition-colors">
              RSVP
            </button>
          </div>
        </div>

        {/* Quick Access */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">
            Quick Access
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Tile 1 */}
            <button className="bg-white p-5 rounded-[12px] border border-[#e5e7eb] flex flex-col items-center justify-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-md transition-shadow active:scale-95">
              <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                <Rss size={24} className="text-[#00b2a9]" />
              </div>
              <span className="text-[13px] font-semibold text-[#1f2937]">News</span>
            </button>

            {/* Tile 2 */}
            <button className="bg-white p-5 rounded-[12px] border border-[#e5e7eb] flex flex-col items-center justify-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-md transition-shadow active:scale-95">
              <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                <Users size={24} className="text-[#00b2a9]" />
              </div>
              <span className="text-[13px] font-semibold text-[#1f2937]">Investigators</span>
            </button>

            {/* Tile 3 */}
            <button className="bg-white p-5 rounded-[12px] border border-[#e5e7eb] flex flex-col items-center justify-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-md transition-shadow active:scale-95">
              <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                <LifeBuoy size={24} className="text-[#00b2a9]" />
              </div>
              <span className="text-[13px] font-semibold text-[#1f2937] text-center leading-tight">Supporting<br/>Resources</span>
            </button>

            {/* Tile 4 */}
            <button className="bg-white p-5 rounded-[12px] border border-[#e5e7eb] flex flex-col items-center justify-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-md transition-shadow active:scale-95 relative overflow-hidden">
              <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center">
                <Package size={24} className="text-[#00b2a9]" />
              </div>
              <span className="text-[13px] font-semibold text-[#1f2937] text-center leading-tight">Equipment<br/>Inventory</span>
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-3 px-1">
            <button className="flex items-center justify-between group">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0069a6]">
                <Pencil size={16} />
                <span>Sign Up for Tuesdays</span>
              </div>
              <ArrowRight size={16} className="text-[#0069a6] opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

      </main>

      {/* Fixed CTA at bottom */}
      <div className="absolute bottom-8 left-5 right-5">
        <button className="w-full bg-[#0069a6] text-white p-4 rounded-[14px] flex items-center justify-between shadow-lg hover:bg-[#005a8f] transition-colors active:scale-95">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <Mail size={20} />
            </div>
            <span className="font-semibold">Contact Cheryl Dudek</span>
          </div>
          <ArrowRight size={20} className="opacity-80" />
        </button>
      </div>
    </div>
  );
}

export default Dashboard;