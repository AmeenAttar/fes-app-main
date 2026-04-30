import React from "react";
import { 
  Home, 
  Rss, 
  Calendar, 
  Users, 
  LifeBuoy, 
  Package, 
  Pencil, 
  X, 
  Mail
} from "lucide-react";

export function SideDrawer() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-8">
      {/* Phone Frame */}
      <div 
        className="relative overflow-hidden bg-white shadow-2xl ring-1 ring-black/5"
        style={{ width: 390, height: 844, fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        {/* BACKGROUND: Simplified Home Menu Screen */}
        <div className="absolute inset-0 bg-white">
          <div className="pt-14 px-6 pb-6">
            <img 
              src="/__mockup/images/fes-logo.png" 
              alt="FES Logo" 
              className="h-10 mb-8"
              style={{ objectFit: 'contain' }}
            />
            <div className="grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div 
                  key={i}
                  className="rounded-2xl h-32"
                  style={{ background: 'linear-gradient(160deg, #00bfb5, #009f9a)' }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* OVERLAY / SCRIM */}
        <div 
          className="absolute inset-0 z-10 flex"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        >
          {/* Left empty space (scrim) */}
          <div style={{ width: '28%' }} />

          {/* Right Drawer Panel */}
          <div 
            className="h-full shadow-2xl flex flex-col relative"
            style={{ 
              width: '72%', 
              backgroundColor: '#0d1b2e',
              paddingTop: 56,
              paddingLeft: 24,
              paddingRight: 24
            }}
          >
            {/* Top: Close & Logo */}
            <div className="flex flex-col mb-6 relative">
              <button className="absolute -top-2 -right-2 p-2">
                <X color="white" size={28} strokeWidth={2} />
              </button>
              
              <div className="mt-2 mb-6">
                <img 
                  src="/__mockup/images/fes-logo.png" 
                  alt="FES Logo White"
                  style={{ height: 32, filter: 'brightness(0) invert(1)', objectFit: 'contain' }} 
                />
              </div>
              
              {/* Divider */}
              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto pb-6">
              <div className="flex flex-col">
                <NavItem icon={<Home size={22} />} label="Home" active />
                <NavItem icon={<Rss size={22} />} label="News" />
                <NavItem icon={<Calendar size={22} />} label="Events" />
                <NavItem icon={<Users size={22} />} label="Investigators" />
                <NavItem icon={<LifeBuoy size={22} />} label="Supporting Resources" />
                <NavItem icon={<Package size={22} />} label="Equipment Inventory" />
                <NavItem icon={<Pencil size={22} />} label="Sign Up for Tuesdays!" />
              </div>
            </div>

            {/* Bottom Contact */}
            <div className="pb-10 pt-4 flex items-center gap-3">
              <Mail size={16} color="rgba(255,255,255,0.6)" />
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                Contact Cheryl Dudek
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div 
      className="flex flex-row items-center relative cursor-pointer group"
      style={{
        paddingTop: 16,
        paddingBottom: 16,
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      {active && (
        <div 
          className="absolute left-0 top-0 bottom-0"
          style={{ width: 3, backgroundColor: '#00b2a9', marginLeft: -24 }}
        />
      )}
      
      <div 
        className="flex items-center justify-center mr-4"
        style={{ 
          color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
          transition: 'color 0.2s'
        }}
      >
        {icon}
      </div>
      
      <div 
        className="flex-1"
        style={{ 
          fontWeight: 700, 
          fontSize: 17, 
          color: '#ffffff', 
          letterSpacing: 0.3 
        }}
      >
        {label}
      </div>
    </div>
  );
}
