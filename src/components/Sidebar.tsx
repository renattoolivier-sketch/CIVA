import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Building2, 
  Folder, 
  MapPin, 
  Trophy,
  Search,
  Monitor,
  LayoutDashboard,
  History,
  AlertTriangle
} from 'lucide-react';
import { Secretariat, Location, CameraStatus } from '../types';

interface SidebarProps {
  secretariats: Secretariat[];
  locations: Location[];
  onSelectLocation: (loc: Location) => void;
  onSelectView: (view: 'dashboard' | 'history') => void;
  selectedLocationId?: string;
  activeView: string;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  secretariats, 
  locations, 
  onSelectLocation, 
  onSelectView,
  selectedLocationId,
  activeView
}) => {
  const [expandedSecs, setExpandedSecs] = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const toggleSec = (id: string) => {
    setExpandedSecs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSub = (id: string) => {
    setExpandedSubs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getSubSecretariats = (secId: string) => {
    const subs = new Set<string>();
    locations.filter(l => l.secretariatId === secId).forEach(l => {
      if (l.subSecretariat) subs.add(l.subSecretariat);
    });
    return Array.from(subs);
  };

  const hasError = (locId: string) => {
    const loc = locations.find(l => l.id === locId);
    return loc?.cameras.some(c => c.status === CameraStatus.ERROR);
  };

  const secHasError = (secId: string) => {
    return locations.filter(l => l.secretariatId === secId).some(l => l.cameras.some(c => c.status === CameraStatus.ERROR));
  };

  const subHasError = (secId: string, sub: string) => {
    return locations.filter(l => l.secretariatId === secId && l.subSecretariat === sub).some(l => l.cameras.some(c => c.status === CameraStatus.ERROR));
  };

  return (
    <div className="w-80 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="relative group mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Recursos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-200"
          />
        </div>
        
        <div className="space-y-1">
          <button 
            onClick={() => onSelectView('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button 
            onClick={() => onSelectView('history')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            <History className="w-4 h-4" />
            Histórico
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        <div className="mb-2 px-3 py-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <Monitor className="w-3 h-3" />
            Recursos / Local Atual
          </div>
        </div>

        {secretariats.map(sec => (
          <div key={sec.id} className="mb-1">
            <button 
              onClick={() => toggleSec(sec.id)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 group transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedSecs[sec.id] ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                <Folder className="w-4 h-4 text-blue-500" />
                <span className={`text-sm font-semibold truncate ${secHasError(sec.id) ? 'text-rose-400' : 'text-slate-300'}`}>
                  {sec.name}
                </span>
              </div>
              {secHasError(sec.id) && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />}
            </button>

            {expandedSecs[sec.id] && (
              <div className="ml-4 mt-1 border-l border-slate-800 pl-2 space-y-1">
                {/* Render Sub-Secretariats */}
                {getSubSecretariats(sec.id).map(sub => (
                  <div key={sub}>
                    <button 
                      onClick={() => toggleSub(`${sec.id}-${sub}`)}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-slate-800 group transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSubs[`${sec.id}-${sub}`] ? <ChevronDown className="w-3 h-3 text-slate-600" /> : <ChevronRight className="w-3 h-3 text-slate-600" />}
                        <Folder className="w-3.5 h-3.5 text-blue-800" />
                        <span className={`text-[13px] font-medium truncate ${subHasError(sec.id, sub) ? 'text-rose-400/80' : 'text-slate-400'}`}>
                          {sub}
                        </span>
                      </div>
                    </button>
                    
                    {expandedSubs[`${sec.id}-${sub}`] && (
                      <div className="ml-4 mt-1 space-y-0.5">
                        {locations.filter(l => l.secretariatId === sec.id && l.subSecretariat === sub).map(loc => (
                          <button 
                            key={loc.id}
                            onClick={() => onSelectLocation(loc)}
                            className={`w-full flex items-center justify-between px-3 py-1 rounded-lg text-[12px] group transition-all ${selectedLocationId === loc.id ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'hover:bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className={`w-3 h-3 ${hasError(loc.id) ? 'text-rose-500' : 'text-slate-600'}`} />
                              <span className="truncate">{loc.name}</span>
                            </div>
                            <span className="text-[9px] opacity-40 group-hover:opacity-100">({loc.cameras.length})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Render Locations without sub-secretariat */}
                {locations.filter(l => l.secretariatId === sec.id && !l.subSecretariat).map(loc => (
                   <button 
                    key={loc.id}
                    onClick={() => onSelectLocation(loc)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] group transition-all ${selectedLocationId === loc.id ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'hover:bg-slate-800 text-slate-500 hover:text-slate-300 font-medium'}`}
                  >
                    <div className="flex items-center gap-2">
                       <MapPin className={`w-3.5 h-3.5 ${hasError(loc.id) ? 'text-rose-500' : 'text-slate-600'}`} />
                      <span className="truncate">{loc.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white uppercase">
            AD
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold text-slate-300 truncate tracking-tight">Administrador</p>
            <p className="text-[10px] text-slate-500 truncate">Sessão Ativa • 10.2.2.170</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
