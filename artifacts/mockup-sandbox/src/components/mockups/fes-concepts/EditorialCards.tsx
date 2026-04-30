import React from "react";
import { Rss, Calendar, Users, LifeBuoy, Mail, Menu, ArrowRight } from "lucide-react";

export function EditorialCards() {
  return (
    <div
      style={{
        width: "390px",
        height: "844px",
        fontFamily: "'Inter', system-ui, sans-serif",
        backgroundColor: "#f9fafb", // Very light gray to make white cards pop
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <div className="bg-white flex-shrink-0 flex items-center justify-between px-4 py-3 relative z-10" style={{ borderBottom: "2px solid #00b2a9" }}>
        <div className="w-8" /> {/* Spacer */}
        <div className="flex flex-col items-center">
          <img src="/__mockup/images/fes-logo.png" alt="FES Logo" style={{ height: "40px", objectFit: "contain" }} />
          <span style={{ color: "#00b2a9", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", marginTop: "2px" }}>
            Cleveland FES Center
          </span>
        </div>
        <button className="w-8 h-8 flex items-center justify-center text-gray-700">
          <Menu size={24} />
        </button>
      </div>

      {/* Feed Area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5 pb-24">
        
        {/* Card 1 - Events */}
        <div 
          className="rounded-[14px] p-5 flex flex-col justify-between shadow-sm relative overflow-hidden"
          style={{ 
            background: "linear-gradient(135deg, #00bfb5 0%, #009f9a 100%)",
            minHeight: "180px"
          }}
        >
          <div className="flex items-center gap-1.5 text-white/90 mb-4">
            <Calendar size={14} />
            <span className="text-xs font-semibold tracking-wider">EVENTS</span>
          </div>
          
          <div className="mb-6">
            <h2 className="text-white text-[22px] font-bold leading-tight mb-2">Monthly Investigator Roundtable</h2>
            <p className="text-white/90 text-sm">Tuesday, May 6 · 9:00 AM</p>
          </div>
          
          <div className="flex items-center justify-between mt-auto">
            <button className="bg-white text-[#009f9a] px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm">
              RSVP
            </button>
            <button className="text-white text-xs font-medium flex items-center gap-1 opacity-90 hover:opacity-100">
              See all events <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Card 2 - News */}
        <div 
          className="rounded-[14px] p-5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#e6f7f6] flex items-center justify-center text-[#00b2a9]">
                <Rss size={16} />
              </div>
              <span className="text-gray-500 text-xs font-bold tracking-wider">NEWS</span>
            </div>
          </div>
          
          <h3 className="text-[#1f2937] text-lg font-bold leading-snug mb-2">
            FES Center Receives NIH Funding for Novel FES Protocol Study
          </h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">
            The center has been awarded $2.3M for a multi-site study exploring advanced stimulation protocols in...
          </p>
          
          <button className="text-[#00b2a9] text-xs font-semibold flex items-center gap-1 self-start mt-1">
            Read more on fescenter.org <ArrowRight size={12} />
          </button>
        </div>

        {/* Card 3 - Investigators */}
        <div 
          className="rounded-[14px] p-5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col"
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#e6f7f6] flex items-center justify-center text-[#00b2a9]">
                <Users size={16} />
              </div>
              <span className="text-gray-500 text-xs font-bold tracking-wider">INVESTIGATORS</span>
            </div>
            <button className="text-gray-400 text-xs font-medium flex items-center gap-1">
              View all <ArrowRight size={12} />
            </button>
          </div>
          
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm border-2 border-white shadow-sm -mr-3 relative z-30">JD</div>
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm border-2 border-white shadow-sm -mr-3 relative z-20">SR</div>
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm border-2 border-white shadow-sm relative z-10">MK</div>
          </div>
          
          <p className="text-gray-500 text-xs pl-1">28 investigators across 6 departments</p>
        </div>

        {/* Card 4 - Resources */}
        <div 
          className="rounded-[14px] p-5 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col mb-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#e6f7f6] flex items-center justify-center text-[#00b2a9]">
              <LifeBuoy size={16} />
            </div>
            <span className="text-gray-500 text-xs font-bold tracking-wider">SUPPORTING RESOURCES</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
              {['Budgets', 'IRB', 'Legal', 'HR'].map(item => (
                <div key={item} className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center">
                  {item}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {['Equipment', 'Stats', 'IT', 'Publishing'].map(item => (
                <div key={item} className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Footer bar */}
      <div 
        className="absolute bottom-0 left-0 right-0 py-4 px-5 flex items-center justify-center gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-20 cursor-pointer"
        style={{ backgroundColor: "#0069a6" }}
      >
        <Mail className="text-white" size={18} />
        <span className="text-white font-medium text-sm">Contact Cheryl Dudek</span>
      </div>

    </div>
  );
}

export default EditorialCards;
