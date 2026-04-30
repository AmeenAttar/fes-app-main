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
  ExternalLink,
  Mail
} from "lucide-react";

export function TileGrid() {
  return (
    <div 
      className="relative overflow-hidden font-sans"
      style={{
        width: 390,
        height: 844,
        backgroundColor: "#f4f4f5", // Light background behind the fake home screen
        fontFamily: "'Inter', system-ui, sans-serif"
      }}
    >
      {/* BACKGROUND SCENE: Fake Home Screen */}
      <div className="absolute inset-0 flex flex-col p-5 pt-14">
        {/* Fake Header */}
        <div className="flex justify-between items-center mb-8">
          <img 
            src="/__mockup/images/fes-logo.png" 
            alt="FES Logo" 
            style={{ height: 36 }}
          />
          <div className="w-10 h-10 rounded-full flex items-center justify-center border border-gray-200">
             {/* Fake hamburger */}
             <div className="space-y-1">
               <div className="w-5 h-[2px] bg-black"></div>
               <div className="w-5 h-[2px] bg-black"></div>
               <div className="w-5 h-[2px] bg-black"></div>
             </div>
          </div>
        </div>
        
        {/* Fake Grid */}
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div 
              key={i}
              className="rounded-2xl"
              style={{
                height: 140,
                background: "linear-gradient(160deg, #00bfb5, #009f9a)"
              }}
            />
          ))}
        </div>
      </div>

      {/* OVERLAY */}
      <div 
        className="absolute inset-0 flex flex-col"
        style={{
          backgroundColor: "rgba(0,10,25,0.90)",
          backdropFilter: "blur(4px)" // slight blur for better separation
        }}
      >
        {/* Header Row */}
        <div 
          className="flex justify-between items-center"
          style={{
            paddingTop: 52,
            paddingLeft: 20,
            paddingRight: 20,
            marginBottom: 24
          }}
        >
          <img 
            src="/__mockup/images/fes-logo.png" 
            alt="FES Logo" 
            style={{ 
              height: 36,
              filter: "brightness(0) invert(1)"
            }}
          />
          <button 
            className="flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.12)"
            }}
          >
            <X size={22} color="white" />
          </button>
        </div>

        {/* Home Button */}
        <div style={{ padding: "0 20px", marginBottom: 20 }}>
          <button 
            className="w-full flex items-center justify-center gap-3"
            style={{
              height: 54,
              borderRadius: 16,
              background: "linear-gradient(135deg, #0069a6, #0081c8)"
            }}
          >
            <Home size={22} color="white" />
            <span 
              style={{
                color: "white",
                fontWeight: 700,
                fontSize: 17,
                textTransform: "uppercase",
                letterSpacing: "1.5px"
              }}
            >
              Home
            </span>
          </button>
        </div>

        {/* Grid */}
        <div 
          className="grid grid-cols-2"
          style={{
            gap: 12,
            padding: "0 20px",
            flex: 1
          }}
        >
          {/* Tile 1: News */}
          <button 
            className="relative flex flex-col items-center justify-center"
            style={{
              backgroundColor: "rgba(0,178,169,0.18)",
              border: "1px solid rgba(0,178,169,0.30)",
              borderRadius: 16,
              height: 110,
              gap: 10
            }}
          >
            <ExternalLink 
              size={10} 
              color="rgba(255,255,255,0.4)" 
              className="absolute top-3 right-3" 
            />
            <Rss size={26} color="#00b2a9" />
            <span style={{
              fontWeight: 600,
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
              textAlign: "center",
              letterSpacing: "0.8px",
              textTransform: "uppercase"
            }}>
              News
            </span>
          </button>

          {/* Tile 2: Events */}
          <button 
            className="relative flex flex-col items-center justify-center"
            style={{
              backgroundColor: "rgba(0,178,169,0.18)",
              border: "1px solid rgba(0,178,169,0.30)",
              borderRadius: 16,
              height: 110,
              gap: 10
            }}
          >
            <Calendar size={26} color="#00b2a9" />
            <span style={{
              fontWeight: 600,
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
              textAlign: "center",
              letterSpacing: "0.8px",
              textTransform: "uppercase"
            }}>
              Events
            </span>
          </button>

          {/* Tile 3: Investigators */}
          <button 
            className="relative flex flex-col items-center justify-center"
            style={{
              backgroundColor: "rgba(0,178,169,0.18)",
              border: "1px solid rgba(0,178,169,0.30)",
              borderRadius: 16,
              height: 110,
              gap: 10
            }}
          >
            <Users size={26} color="#00b2a9" />
            <span style={{
              fontWeight: 600,
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
              textAlign: "center",
              letterSpacing: "0.8px",
              textTransform: "uppercase"
            }}>
              Investigators
            </span>
          </button>

          {/* Tile 4: Supporting Resources */}
          <button 
            className="relative flex flex-col items-center justify-center"
            style={{
              backgroundColor: "rgba(0,178,169,0.18)",
              border: "1px solid rgba(0,178,169,0.30)",
              borderRadius: 16,
              height: 110,
              gap: 10,
              padding: "0 10px"
            }}
          >
            <LifeBuoy size={26} color="#00b2a9" />
            <span style={{
              fontWeight: 600,
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
              textAlign: "center",
              letterSpacing: "0.8px",
              textTransform: "uppercase"
            }}>
              Supporting<br/>Resources
            </span>
          </button>

          {/* Tile 5: Equipment Inventory */}
          <button 
            className="relative flex flex-col items-center justify-center"
            style={{
              backgroundColor: "rgba(0,178,169,0.18)",
              border: "1px solid rgba(0,178,169,0.30)",
              borderRadius: 16,
              height: 110,
              gap: 10,
              padding: "0 10px"
            }}
          >
            <Package size={26} color="#00b2a9" />
            <span style={{
              fontWeight: 600,
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
              textAlign: "center",
              letterSpacing: "0.8px",
              textTransform: "uppercase"
            }}>
              Equipment<br/>Inventory
            </span>
          </button>

          {/* Tile 6: Sign Up for Tuesdays! */}
          <button 
            className="relative flex flex-col items-center justify-center"
            style={{
              backgroundColor: "rgba(0,178,169,0.18)",
              border: "1px solid rgba(0,178,169,0.30)",
              borderRadius: 16,
              height: 110,
              gap: 10,
              padding: "0 10px"
            }}
          >
            <Pencil size={26} color="#00b2a9" />
            <span style={{
              fontWeight: 600,
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
              textAlign: "center",
              letterSpacing: "0.8px",
              textTransform: "uppercase"
            }}>
              Sign Up For<br/>Tuesdays!
            </span>
          </button>
        </div>

        {/* Bottom Strip */}
        <button 
          className="flex justify-center items-center gap-2 mt-auto"
          style={{
            padding: "16px 20px",
            marginBottom: 20
          }}
        >
          <Mail size={18} color="white" />
          <span 
            style={{
              color: "white",
              fontSize: 14,
              fontWeight: 500,
              opacity: 0.7
            }}
          >
            Contact Cheryl Dudek
          </span>
        </button>
      </div>
    </div>
  );
}

export default TileGrid;