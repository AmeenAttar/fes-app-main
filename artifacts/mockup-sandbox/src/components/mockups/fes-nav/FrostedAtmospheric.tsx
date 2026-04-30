import React from 'react';
import { Home, Rss, Calendar, Users, LifeBuoy, Package, Pencil, X, Mail } from 'lucide-react';

export function FrostedAtmospheric() {
  const navItems = [
    { label: "Home", icon: Home, active: true },
    { label: "News", icon: Rss },
    { label: "Events", icon: Calendar },
    { label: "Investigators", icon: Users },
    { label: "Supporting Resources", icon: LifeBuoy },
    { label: "Equipment Inventory", icon: Package },
    { label: "Sign Up for Tuesdays!", icon: Pencil },
  ];

  return (
    <div style={{ width: 390, height: 844, position: 'relative', overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Background Layer: Simplified Home Menu Screen */}
      <div style={{ width: '100%', height: '100%', backgroundColor: '#f8fafc', padding: '24px' }}>
        {/* Background Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingTop: '32px' }}>
          <img src="/__mockup/images/fes-logo.png" alt="FES Logo" style={{ height: 36 }} />
          <div style={{ width: 24, height: 24, backgroundColor: '#cbd5e1', borderRadius: 4 }} />
        </div>
        {/* Background Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[...Array(6)].map((_, i) => (
            <div 
              key={i} 
              style={{ 
                height: 120, 
                borderRadius: 16, 
                background: 'linear-gradient(160deg, #00bfb5, #009f9a)' 
              }} 
            />
          ))}
        </div>
      </div>

      {/* Overlay Layer */}
      <div style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        backgroundColor: 'rgba(0,20,40,0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 24px 48px',
      }}>
        {/* Depth gradient at bottom */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '40%',
          background: 'linear-gradient(to bottom, transparent, rgba(0,40,80,0.4))',
          pointerEvents: 'none'
        }} />

        {/* Header Row */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: '16px',
          zIndex: 10
        }}>
          <img 
            src="/__mockup/images/fes-logo.png" 
            alt="FES Logo" 
            style={{ height: 36, filter: 'brightness(0) invert(1)' }} 
          />
          <button style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            <X size={22} color="white" />
          </button>
        </div>

        <div style={{ height: 28 }} />

        {/* Navigation Items */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 10 }}>
          {navItems.map((item, i) => (
            <div 
              key={i} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '18px 0',
                cursor: 'pointer'
              }}
            >
              <item.icon size={24} color={item.active ? '#00b2a9' : 'rgba(255,255,255,0.40)'} style={{ marginRight: 16 }} />
              <span style={{ 
                color: item.active ? '#00b2a9' : '#ffffff', 
                fontSize: 26, 
                fontWeight: item.active ? 700 : 300, 
                letterSpacing: '-0.3px',
                flex: 1
              }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ height: 28 }} />

        {/* Bottom Section */}
        <div style={{ zIndex: 10 }}>
          <div style={{ width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginBottom: 24 }} />
          <button style={{
            backgroundColor: 'rgba(0,178,169,0.15)',
            border: '1px solid rgba(0,178,169,0.3)',
            borderRadius: 24,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer'
          }}>
            <Mail size={16} color="#00b2a9" />
            <span style={{ color: '#00b2a9', fontSize: 14, fontWeight: 600 }}>Contact Cheryl Dudek</span>
          </button>
        </div>
      </div>
    </div>
  );
}
