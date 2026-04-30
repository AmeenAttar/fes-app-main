import React from 'react';
import { Rss, Calendar, Users, LifeBuoy, Package, Pencil, Mail, Search, Menu } from 'lucide-react';

export function SearchFirst() {
  const recentSearches = ["Dr. Smith", "Lab Equipment", "May Events"];
  
  const navItems = [
    { title: "News", icon: Rss, link: true },
    { title: "Events", icon: Calendar, link: true },
    { title: "Investigators", icon: Users, link: true },
    { title: "Supporting Resources", icon: LifeBuoy, link: true },
    { title: "Equipment Inventory", icon: Package, link: true },
    { title: "Sign Up for Tuesdays!", icon: Pencil, link: true },
  ];

  return (
    <div 
      className="relative bg-white overflow-hidden flex flex-col font-sans"
      style={{ width: 390, height: 844, fontFamily: "'Inter', system-ui, sans-serif", color: "#1f2937" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <img src="/__mockup/images/fes-logo.png" alt="FES Logo" style={{ height: 46, objectFit: 'contain' }} />
        <button className="p-2 -mr-2 text-gray-800">
          <Menu size={28} strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex-1 flex flex-col px-5 pb-5 overflow-y-auto">
        {/* Search Bar */}
        <div className="mt-2 mb-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search size={20} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search people, events, resources..."
              className="w-full pl-11 pr-4 py-3 bg-white outline-none placeholder-gray-400 text-[15px]"
              style={{
                height: 48,
                borderRadius: 24,
                border: '1.5px solid #e5e7eb',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}
            />
          </div>
        </div>

        {/* RECENTLY VISITED */}
        <div className="mb-6">
          <h2 className="text-[11px] font-bold text-gray-400 tracking-wider uppercase mb-3 px-1">Recently Visited</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
            {recentSearches.map((item, i) => (
              <button
                key={i}
                className="whitespace-nowrap flex items-center"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 20,
                  padding: '6px 12px',
                  fontSize: 13,
                  color: '#4b5563',
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-gray-100 w-full mb-6"></div>

        {/* ALL SECTIONS */}
        <div className="flex-1">
          <h2 className="text-[11px] font-bold text-gray-400 tracking-wider uppercase mb-4 px-1">All Sections</h2>
          <div className="grid grid-cols-2 gap-3 pb-24">
            {navItems.map((item, i) => (
              <button
                key={i}
                className="flex flex-col items-center justify-center p-4 text-center active:scale-95 transition-transform"
                style={{
                  background: 'linear-gradient(160deg, #00bfb5, #009f9a)',
                  borderRadius: 14,
                  minHeight: 110,
                }}
              >
                <div className="w-12 h-12 rounded-full mb-3 flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
                  <item.icon size={24} color="white" strokeWidth={2} />
                </div>
                <span className="text-white text-[12px] font-bold tracking-[0.5px] uppercase leading-tight">
                  {item.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Bar */}
      <div 
        className="absolute bottom-0 left-0 right-0 px-5 py-6 pb-10"
        style={{
          background: 'linear-gradient(to top, white 60%, transparent)',
        }}
      >
        <button 
          className="w-full rounded-2xl flex items-center justify-between p-4 shadow-lg active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #0069a6, #005a8f)',
          }}
        >
          <span className="text-white font-semibold text-[15px] pl-2">Contact Cheryl Dudek</span>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Mail size={20} className="text-white" />
          </div>
        </button>
      </div>
    </div>
  );
}