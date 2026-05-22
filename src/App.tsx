/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Video, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Search,
  History,
  Wrench,
  Info,
  HeartPulse,
  GraduationCap,
  Users,
  ShieldCheck,
  Map as MapIcon,
  MapPin,
  AlertCircle,
  ArrowLeft,
  Trash2,
  Edit3,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  Lock,
  Printer,
  User as UserIcon,
  Plus,
  X,
  Download,
  Smartphone,
  Copy,
  ShieldAlert,
  Key,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SystemActivityLogs from './components/SystemActivityLogs';
import { 
  CameraStatus, 
  Secretariat, 
  Location, 
  Camera, 
  MaintenanceLog 
} from './types';
import { secretariats as initialSecretariats, locations as initialLocations } from './data/mockData';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef, useMap } from '@vis.gl/react-google-maps';
import { extractCoordsFromGoogleMapsLink } from './lib/maps';
import { supabase } from './lib/supabase';

interface UserProfile {
  id?: string;
  username: string;
  role: 'admin' | 'viewer';
}

// Icons mapping helper
const IconMap: { [key: string]: any } = {
  HeartPulse,
  GraduationCap,
  Users,
  ShieldCheck,
  Map: MapIcon,
};

const MAP_API_KEY = 
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || 
  (import.meta as any).env?.GOOGLE_MAPS_PLATFORM_KEY || 
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

console.log('[CIVA] Verificando Chave do Mapa:', MAP_API_KEY ? 'Presente' : 'Ausente');

const hasValidMapKey = Boolean(MAP_API_KEY) && MAP_API_KEY.length > 20 && MAP_API_KEY !== 'YOUR_API_KEY';

function MarkerWithInfoWindow({ position, location, onSelect }: { 
  position: google.maps.LatLngLiteral, 
  location: Location,
  onSelect: (loc: Location) => void ,
  key?: string | number
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoWindowShown, setInfoWindowShown] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const hasAlert = location.cameras.some(c => c.status === CameraStatus.ERROR);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        onClick={() => setInfoWindowShown(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          className={`px-3 py-1.5 rounded-full shadow-lg border-2 border-white flex items-center gap-2 whitespace-nowrap transition-all transform ${isHovered ? 'scale-110' : 'scale-100'} ${hasAlert ? 'bg-rose-600' : 'bg-emerald-600'}`}
        >
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          <span className="text-[10px] font-black text-white uppercase tracking-wider">{location.name}</span>
        </div>
      </AdvancedMarker>

      {(infoWindowShown || isHovered) && (
        <InfoWindow
          anchor={marker}
          onCloseClick={() => setInfoWindowShown(false)}
          headerDisabled={true}
        >
          <div className="p-2 min-w-[180px]">
            <h3 className="font-black text-slate-900 border-b border-slate-100 pb-1.5 mb-2 uppercase text-[10px] tracking-tight">{location.name}</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Rede (IP)</span>
                <span className="font-mono text-blue-600 font-bold">{location.ip}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Câmeras</span>
                <span className={`font-black ${hasAlert ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {location.cameras.length} ({location.cameras.filter(c => c.status === CameraStatus.ONLINE).length} ON)
                </span>
              </div>
            </div>
            {infoWindowShown && (
              <button
                onClick={() => {
                  onSelect(location);
                  setInfoWindowShown(false);
                }}
                className="w-full mt-3 bg-blue-600 text-white text-[9px] font-black py-2 rounded-xl uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
              >
                Abrir Central
              </button>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function MapBoundsHandler({ mappedLocations }: { mappedLocations: { coords: { lat: number, lng: number } }[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || mappedLocations.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    mappedLocations.forEach(item => bounds.extend(item.coords));
    map.fitBounds(bounds, 50);
  }, [map, mappedLocations]);

  return null;
}

export default function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'cameras' | 'history' | 'locations' | 'reports' | 'map' | 'users' | 'logs'>('dashboard');
  const [selectedSecretariat, setSelectedSecretariat] = useState<Secretariat | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [secretariats, setSecretariats] = useState<Secretariat[]>(initialSecretariats);
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [appUsers, setAppUsers] = useState<UserProfile[]>([]);
  
  // System Activity Audit Logs
  const [activityLogs, setActivityLogs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('civa_activity_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const logActivity = async (action: string, details: string, currentUserOverride?: UserProfile) => {
    const activeUser = currentUserOverride || user;
    if (!activeUser) return;

    const newLog = {
      id: crypto.randomUUID(),
      username: activeUser.username,
      role: activeUser.role,
      action: action,
      details: details,
      timestamp: new Date().toISOString(),
      ip_address: 'Local/Client'
    };

    // Immediate UI update and LocalStorage persistence
    setActivityLogs(prev => [newLog, ...prev]);
    try {
      const currentLogsString = localStorage.getItem('civa_activity_logs');
      const currentLogs = currentLogsString ? JSON.parse(currentLogsString) : [];
      localStorage.setItem('civa_activity_logs', JSON.stringify([newLog, ...currentLogs]));
    } catch (e) {
      console.error('[CIVA] Erro ao salvar localmente o log:', e);
    }

    // Attempt to persist to Supabase if present
    if (supabase) {
      try {
        await supabase.from('activity_logs').insert(newLog);
      } catch (err) {
        // Safe check catch, won't block execution if table hasn't been created yet
        console.warn('[CIVA] Log de auditoria persistido localmente. Execute a migração SQL do Supabase para suporte a nuvem em tempo real.');
      }
    }
  };
  const [repairingCamera, setRepairingCamera] = useState<{ locationId: string, camera: Camera } | null>(null);
  const [reportingCamProblem, setReportingCamProblem] = useState<{ locationId: string, camera: Camera } | null>(null);
  const [isSelectingLocForReport, setIsSelectingLocForReport] = useState(false);

  // CRUD States
  const [isEditingSec, setIsEditingSec] = useState<Secretariat | null>(null);
  const [isAddingSec, setIsAddingSec] = useState(false);
  const [isEditingLoc, setIsEditingLoc] = useState<Location | null>(null);
  const [isExpandingLinks, setIsExpandingLinks] = useState(false);
  const [showUnmappedList, setShowUnmappedList] = useState(false);
  const [isAddingLoc, setIsAddingLoc] = useState(false);
  const [inputMode, setInputMode] = useState<'link' | 'coords'>('link');
  const [reportingLocProblem, setReportingLocProblem] = useState<Location | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: 'sec' | 'loc' | 'cam', id: string, extraId?: string, name: string } | null>(null);

  // Auth State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Sync Status
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>('idle');
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
      console.log('[CIVA PWA] Aplicativo instalado com sucesso!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[CIVA PWA] Usuário aceitou a instalação.');
        } else {
          console.log('[CIVA PWA] Usuário recusou a instalação.');
        }
        setDeferredPrompt(null);
      });
    }
  };

  // Sync selectedLocation with locations array when it changes
  useEffect(() => {
    if (selectedLocation) {
      const refreshed = locations.find(l => l.id === selectedLocation.id);
      if (refreshed) {
        setSelectedLocation(refreshed);
      }
    }
  }, [locations]);

  // Load Auth Session
  useEffect(() => {
    const savedUser = localStorage.getItem('civa_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setAuthLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    const formData = new FormData(e.currentTarget);
    const username = (formData.get('username') as string).trim().toLowerCase();
    const password = (formData.get('password') as string).trim();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .eq('password', password)
          .single();

        if (error || !data) {
          // Fallback de segurança para o administrador principal caso o DB esteja vazio ou com erro
          if (username === 'renato' && password === '32604509') {
              const newUser: UserProfile = { username, role: 'admin' };
              setUser(newUser);
              localStorage.setItem('civa_user', JSON.stringify(newUser));
              logActivity('Acesso/Login', `Usuário administrador logou via plano de contingência`, newUser);
              setLoginError(null);
              return;
          }
          setLoginError('Usuário ou senha incorretos.');
          return;
        }

        const newUser: UserProfile = { 
          id: data.id,
          username: data.username, 
          role: data.role as 'admin' | 'viewer' 
        };
        setUser(newUser);
        localStorage.setItem('civa_user', JSON.stringify(newUser));
        logActivity('Acesso/Login', `Usuário '${newUser.username}' (${newUser.role.toUpperCase()}) logou com sucesso`, newUser);
        setLoginError(null);
      } catch (err) {
        setLoginError('Erro ao conectar ao servidor de banco de dados.');
      }
    } else {
      // Fallback para demo local
      if (username === 'renato' && password === '32604509') {
        const newUser: UserProfile = { username, role: 'admin' };
        setUser(newUser);
        localStorage.setItem('civa_user', JSON.stringify(newUser));
        logActivity('Acesso/Login', `Usuário principal '${username}' logado localmente (Offline)`, newUser);
      } else {
        setLoginError('Sincronização indisponível e falha no login local.');
      }
    }
  };

  const handleLogout = async () => {
    if (user) {
      logActivity('Acesso/Logout', `Usuário '${user.username}' encerrou a sessão`);
    }
    setUser(null);
    localStorage.removeItem('civa_user');
    if (supabase) {
      await supabase.auth.signOut();
    }
  };


  // Real-time Subscriptions with Status Monitoring
  useEffect(() => {
    if (!user || !supabase) return;

    const handleRealtimeChange = (table: string, payload: any) => {
      console.log(`[Realtime] Mudança detectada em ${table}:`, payload);
      loadData();
    };

    console.log('[Realtime] Tentando conectar aos canais...');

    const channel = supabase.channel('civa_realtime_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'secretariats' }, (p) => handleRealtimeChange('secretariats', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, (p) => handleRealtimeChange('locations', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_logs' }, (p) => handleRealtimeChange('maintenance_logs', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (p) => handleRealtimeChange('users', p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, (p) => handleRealtimeChange('activity_logs', p))
      .subscribe((status) => {
        console.log('[Realtime] Status da Conexão:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Conectado e ouvindo mudanças!');
          setSyncStatus('synced');
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Erro no canal. Verifique se o Realtime está habilitado no Dashboard e as políticas RLS.');
          setSyncStatus('error');
          setSyncErrorMessage('Erro na conexão em tempo real. Tente atualizar a página.');
        }
      });

    return () => {
      console.log('[Realtime] Desconectando canais...');
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  const loadData = async () => {
    if (!supabase) {
      setSyncStatus('error');
      setSyncErrorMessage('Supabase não configurado. Verifique as variáveis de ambiente (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) no Vercel.');
      return;
    }
    setSyncStatus('syncing');
    setSyncErrorMessage(null);

    try {
      const [secRes, locRes, logRes, userRes] = await Promise.all([
        supabase.from('secretariats').select('*').order('name'),
        supabase.from('locations').select('*').order('name'),
        supabase.from('maintenance_logs').select('*').order('timestamp', { ascending: false }),
        supabase.from('users').select('*').order('username')
      ]);

      const errors = [];
      if (secRes.error) errors.push(`Secretarias: ${secRes.error.message}`);
      if (locRes.error) errors.push(`Locais: ${locRes.error.message}`);
      if (logRes.error) errors.push(`Histórico: ${logRes.error.message}`);
      if (userRes.error) errors.push(`Usuários: ${userRes.error.message}`);

      if (errors.length > 0) {
        setSyncStatus('error');
        setSyncErrorMessage(errors.join(' | '));
        return;
      }

      if (secRes.data) {
        const mapped = secRes.data.map((s: any) => ({ id: s.id, name: s.name, icon: s.icon }));
        setSecretariats(mapped);
      }
      if (locRes.data) {
        const mapped = locRes.data.map((l: any) => ({
          id: l.id,
          name: l.name,
          ip: l.ip || '',
          server: l.server || '',
          secretariatId: l.secretariat_id,
          subSecretariat: l.sub_secretariat || '',
          cameras: l.cameras || [],
          mapsLink: l.maps_link || ''
        }));
        setLocations(mapped);
      }
      if (logRes.data) {
        const mapped = logRes.data.map((l: any) => ({
          id: l.id,
          cameraId: l.camera_id,
          locationId: l.location_id,
          timestamp: l.timestamp,
          dataConserto: l.data_conserto,
          descricaoTecnica: l.descricao_tecnica,
          ipLocal: l.ip_local || '',
          servidor: l.servidor || ''
        }));
        setMaintenanceLogs(mapped);
      }
      if (userRes.data) {
        setAppUsers(userRes.data);
      }

      // Safe fetch for activity_logs
      try {
        const { data: logsData, error: logsError } = await supabase
          .from('activity_logs')
          .select('*')
          .order('timestamp', { ascending: false });
        if (!logsError && logsData) {
          setActivityLogs(logsData);
        }
      } catch (logErr) {
        console.warn('[CIVA] Tabela activity_logs não encontrada no Supabase. Usando local persistence.');
      }

      setSyncStatus('synced');
    } catch (err: any) {
      console.error('Realtime load error:', err);
      setSyncStatus('error');
      setSyncErrorMessage(err.message || 'Erro de conexão.');
    }
  };

  // Persist state to localStorage and Supabase
  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  // Stats
  const stats = useMemo(() => {
    let total = 0;
    let online = 0;
    let error = 0;
    locations.forEach(loc => {
      loc.cameras.forEach(cam => {
        total++;
        if (cam.status === CameraStatus.ONLINE) online++;
        else error++;
      });
    });
    return { total, online, error };
  }, [locations]);

  // Search Logic
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    
    const query = searchQuery.toLowerCase();
    
    const matchedSecretariats = secretariats.filter(s => s.name.toLowerCase().includes(query));
    
    const matchedLocations = locations.filter(l => 
      l.name.toLowerCase().includes(query) || 
      l.ip.toLowerCase().includes(query) ||
      l.server.toLowerCase().includes(query)
    );
    
    const matchedCameras = locations.flatMap(l => 
      l.cameras.filter(c => 
        `cam ${c.number}`.toLowerCase().includes(query) ||
        `${l.id}-00${c.number}`.toLowerCase().includes(query)
      ).map(c => ({ ...c, location: l }))
    );

    return {
      secretariats: matchedSecretariats,
      locations: matchedLocations,
      cameras: matchedCameras
    };
  }, [searchQuery, secretariats, locations]);

  // Handlers
  const handleSelectLocation = (loc: Location) => {
    setSelectedLocation(loc);
    setSelectedSecretariat(secretariats.find(s => s.id === loc.secretariatId) || null);
    setCurrentView('cameras');
  };

  const handleCopyReport = (reportText: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(reportText);
      alert('Relatório copiado para a área de transferência!');
    } else {
      // Fallback for environments where navigator.clipboard is not available
      const textArea = document.createElement("textarea");
      textArea.value = reportText;
      // Ensure the textarea is not visible
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert('Relatório copiado!');
      } catch (err) {
        console.error('Erro ao copiar:', err);
        alert('Erro ao copiar relatório.');
      }
      document.body.removeChild(textArea);
    }
  };

  const handleSelectSecretariat = (sec: Secretariat) => {
    setSelectedSecretariat(sec);
    setCurrentView('locations');
    
    // Set default tab based on secretariat
    if (sec.id === 'educacao') {
      setSelectedTab('ESCOLAS');
    } else if (sec.id === 'saude') {
      setSelectedTab('POSTOS DE SAÚDE');
    } else {
      setSelectedTab(null);
    }
  };

  const handleSelectView = (view: 'dashboard' | 'history' | 'reports' | 'map') => {
    setCurrentView(view);
    setSelectedLocation(null);
    setSelectedSecretariat(null);
  };

  const handleReportsView = () => {
    setCurrentView('reports');
    setSelectedLocation(null);
    setSelectedSecretariat(null);
  };
  const toggleCameraStatus = async (locationId: string, cameraId: string) => {
    const loc = locations.find(l => l.id === locationId);
    if (!loc || !supabase) return;

    let targetCamNumber = 0;
    let nextStatus = CameraStatus.ONLINE;
    const updatedCameras = loc.cameras.map(cam => {
      if (cam.id === cameraId) {
        targetCamNumber = cam.number;
        const newStatus = cam.status === CameraStatus.ONLINE ? CameraStatus.ERROR : CameraStatus.ONLINE;
        nextStatus = newStatus;
        return { ...cam, status: newStatus };
      }
      return cam;
    });

    const { error } = await supabase
      .from('locations')
      .update({ cameras: updatedCameras })
      .eq('id', locationId);

    if (error) {
      alert(`Erro ao atualizar status: ${error.message}`);
    } else {
      logActivity(
        'Alterou Câmera', 
        `Alterou status da câmera ${targetCamNumber} em ${loc.name} para ${nextStatus.toUpperCase()}`
      );
    }
  };

  const handleReportCameraProblem = async (locationId: string, cameraId: string, reason: string) => {
    const loc = locations.find(l => l.id === locationId);
    if (!loc || !supabase) return;

    const cam = loc.cameras.find(c => c.id === cameraId);
    if (!cam) return;

    const newLog = {
      id: `log-${Date.now()}`,
      camera_id: cam.id,
      location_id: loc.id,
      timestamp: new Date().toISOString(),
      data_conserto: 'PENDENTE',
      descricao_tecnica: `FALHA REPORTADA: ${reason.toUpperCase()}`,
      ip_local: loc.ip,
      servidor: loc.server
    };

    const updatedCameras = loc.cameras.map(c => {
      if (c.id === cameraId) return { ...c, status: CameraStatus.ERROR };
      return c;
    });

    setSyncStatus('syncing');
    const [logRes, locRes] = await Promise.all([
      supabase.from('maintenance_logs').insert(newLog),
      supabase.from('locations').update({ cameras: updatedCameras }).eq('id', locationId)
    ]);

    if (logRes.error || locRes.error) {
      setSyncStatus('error');
      alert('Erro ao registrar falha.');
    } else {
      setSyncStatus('synced');
      logActivity('Reportou Falha', `Reportou falha na câmera ${cam.number} em ${loc.name}: ${reason.toUpperCase()}`);
      await loadData();
    }
    setReportingCamProblem(null);
  };

  // CRUD Functions
  const executeDelete = async () => {
    if (!deletingItem || !supabase) return;
    if (user?.role !== 'admin') {
      alert("Acesso negado: Apenas administradores podem excluir registros.");
      setDeletingItem(null);
      return;
    }

    setSyncStatus('syncing');
    let error;

    if (deletingItem.type === 'sec') {
      const res = await supabase.from('secretariats').delete().eq('id', deletingItem.id);
      error = res.error;
      if (!error && selectedSecretariat?.id === deletingItem.id) {
        setCurrentView('dashboard');
        setSelectedSecretariat(null);
      }
    } else if (deletingItem.type === 'loc') {
      const res = await supabase.from('locations').delete().eq('id', deletingItem.id);
      error = res.error;
      if (!error && selectedLocation?.id === deletingItem.id) {
        setCurrentView('dashboard');
        setSelectedLocation(null);
      }
    } else if (deletingItem.type === 'cam') {
      const locationId = deletingItem.extraId!;
      const cameraId = deletingItem.id;
      const loc = locations.find(l => l.id === locationId);
      if (loc) {
        const updatedCameras = loc.cameras.filter(c => c.id !== cameraId);
        const res = await supabase.from('locations').update({ cameras: updatedCameras }).eq('id', locationId);
        error = res.error;
      }
    }

    if (error) {
      setSyncStatus('error');
      alert(`Erro ao excluir: ${error.message}`);
    } else {
      setSyncStatus('synced');
      const itemLabel = deletingItem.type === 'sec' ? 'Secretaria' : deletingItem.type === 'loc' ? 'Local' : 'Câmera';
      logActivity('Excluiu Registro', `Removeu ${itemLabel}: "${deletingItem.name}" (ID/Nº: ${deletingItem.id})`);
      await loadData();
    }
    setDeletingItem(null);
  };

  const handleReportGeneralProblem = async (locationId: string, problemType: string) => {
    const loc = locations.find(l => l.id === locationId);
    if (!loc || !supabase) return;

    const updatedCameras = loc.cameras.map(c => ({ ...c, status: CameraStatus.ERROR }));
    const newLogs = loc.cameras.map(cam => ({
      id: `log-${Math.random().toString(36).substr(2, 9)}`,
      camera_id: cam.id,
      location_id: loc.id,
      timestamp: new Date().toISOString(),
      data_conserto: 'PENDENTE',
      descricao_tecnica: `PROBLEMA GERAL: ${problemType.toUpperCase()}`,
      ip_local: loc.ip,
      servidor: loc.server
    }));

    setSyncStatus('syncing');
    const [logRes, locRes] = await Promise.all([
      supabase.from('maintenance_logs').insert(newLogs),
      supabase.from('locations').update({ cameras: updatedCameras }).eq('id', locationId)
    ]);

    if (logRes.error || locRes.error) {
      setSyncStatus('error');
      alert('Erro ao registrar problema geral.');
    } else {
      setSyncStatus('synced');
      logActivity('Problema Geral', `Registrou problema geral para o local ${loc.name}: ${problemType.toUpperCase()}`);
      await loadData();
    }
    setReportingLocProblem(null);
  };

  const addCamera = async (locationId: string) => {
    const loc = locations.find(l => l.id === locationId);
    if (!loc || !supabase) return;

    const nextNumber = loc.cameras.length > 0 
      ? Math.max(...loc.cameras.map(c => c.number)) + 1 
      : 1;
    
    const newCamera: Camera = {
      id: `cam-${Math.random().toString(36).substr(2, 9)}`,
      number: nextNumber,
      status: CameraStatus.ONLINE
    };

    const updatedCameras = [...loc.cameras, newCamera];
    const { error } = await supabase.from('locations').update({ cameras: updatedCameras }).eq('id', locationId);
    
    if (error) {
      alert(`Erro ao adicionar câmera: ${error.message}`);
    } else {
      setSyncStatus('synced');
      logActivity('Adicionou Câmera', `Adicionou nova câmera (Nº ${nextNumber}) ao local "${loc.name}"`);
      await loadData();
    }
  };

  const handleSecSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const icon = formData.get('icon') as string;

    const payload = {
      id: isEditingSec ? isEditingSec.id : `sec-${Date.now()}`,
      name,
      icon
    };

    setSyncStatus('syncing');
    const { error } = await supabase.from('secretariats').upsert(payload);
    
    if (error) {
      setSyncStatus('error');
      alert(`Erro ao salvar secretaria: ${error.message}`);
    } else {
      setSyncStatus('synced');
      logActivity(isEditingSec ? 'Editou Secretaria' : 'Adicionou Secretaria', `Nome: "${name}"`);
      await loadData();
      setIsEditingSec(null);
      setIsAddingSec(false);
    }
  };

  const handleLocSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const ip = formData.get('ip') as string;
    const server = formData.get('server') as string;
    const subSecretariat = formData.get('subSecretariat') as string;
    let mapsLink = formData.get('mapsLink') as string;

    if (inputMode === 'coords') {
      const coords = formData.get('coords') as string;
      if (coords) mapsLink = coords;
    }

    const payload = {
      id: isEditingLoc ? isEditingLoc.id : `loc-${Date.now()}`,
      name,
      ip,
      server,
      secretariat_id: isEditingLoc ? isEditingLoc.secretariatId : selectedSecretariat?.id,
      sub_secretariat: subSecretariat || null,
      maps_link: mapsLink || null,
      cameras: isEditingLoc ? isEditingLoc.cameras : []
    };

    setSyncStatus('syncing');
    const { error } = await supabase.from('locations').upsert(payload);

    if (error) {
      setSyncStatus('error');
      alert(`Erro ao salvar local: ${error.message}`);
    } else {
      setSyncStatus('synced');
      logActivity(isEditingLoc ? 'Editou Local' : 'Adicionou Local', `Nome: "${name}", Servidor: "${server}"`);
      await loadData();
      setIsEditingLoc(null);
      setIsAddingLoc(false);
    }
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!repairingCamera || !supabase || !selectedLocation) return;

    const formData = new FormData(e.currentTarget);
    const timestamp = new Date().toISOString();
    
    const newLog = {
      id: `log-${Date.now()}`,
      camera_id: repairingCamera.camera.id,
      location_id: repairingCamera.locationId,
      timestamp,
      data_conserto: formData.get('dataConserto') as string,
      descricao_tecnica: formData.get('descricaoTecnica') as string,
      ip_local: selectedLocation.ip,
      servidor: selectedLocation.server
    };

    const updatedCameras = selectedLocation.cameras.map(cam => {
      if (cam.id === repairingCamera.camera.id) {
        return { ...cam, status: CameraStatus.ONLINE, lastMaintenance: timestamp };
      }
      return cam;
    });

    setSyncStatus('syncing');
    const [logRes, locRes] = await Promise.all([
      supabase.from('maintenance_logs').insert(newLog),
      supabase.from('locations').update({ cameras: updatedCameras }).eq('id', selectedLocation.id)
    ]);

    if (logRes.error || locRes.error) {
      setSyncStatus('error');
      alert('Erro ao concluir reparo.');
    } else {
      setSyncStatus('synced');
      logActivity(
        'Resolveu Pendência', 
        `Realizou reparo na câmera ${repairingCamera.camera.number} em "${selectedLocation.name}": "${formData.get('descricaoTecnica')}"`
      );
      await loadData();
      setRepairingCamera(null);
    }
  };

  const handleRepairLocationGeneral = async (locationId: string) => {
    const loc = locations.find(l => l.id === locationId);
    if (!loc || !supabase) return;

    const timestamp = new Date().toISOString();
    const newLog = {
      id: `log-${Date.now()}`,
      camera_id: 'GERAL',
      location_id: loc.id,
      timestamp,
      data_conserto: new Date().toISOString().split('T')[0],
      descricao_tecnica: 'REPARO GERAL REALIZADO: COMUNICAÇÃO RESTABELECIDA',
      ip_local: loc.ip,
      servidor: loc.server,
    };

    const updatedCameras = loc.cameras.map(cam => ({ 
      ...cam, 
      status: CameraStatus.ONLINE, 
      lastMaintenance: timestamp 
    }));

    setSyncStatus('syncing');
    const [logRes, locRes] = await Promise.all([
      supabase.from('maintenance_logs').insert(newLog),
      supabase.from('locations').update({ cameras: updatedCameras }).eq('id', locationId)
    ]);

    if (logRes.error || locRes.error) {
      setSyncStatus('error');
      alert('Erro ao realizar reparo geral.');
    } else {
      setSyncStatus('synced');
      logActivity(
        'Resolveu Reparo Geral', 
        `Restabeleceu comunicação geral de todas as câmeras para o local "${loc.name}"`
      );
      await loadData();
    }
  };

  const handleUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) {
      alert('Sistema em modo Offline (Sem Supabase). Verifique as variáveis de ambiente no Vercel.');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const username = (formData.get('username') as string).trim().toLowerCase();
    const password = (formData.get('password') as string).trim();
    const role = formData.get('role') as string;

    if (!username || !password) {
      alert("Preencha todos os campos.");
      return;
    }

    setSyncStatus('syncing');
    setSyncErrorMessage(null);
    const { error } = await supabase.from('users').insert({
      username,
      password,
      role
    });

    if (error) {
      console.error("Erro ao criar usuário:", error);
      setSyncStatus('error');
      setSyncErrorMessage(`Falha: ${error.message}. Verifique se o usuário já existe ou permissões RLS.`);
      alert(`Erro: ${error.message}`);
    } else {
      setSyncStatus('synced');
      logActivity('Criou de Usuário', `Cadastrou novo usuário: "${username}" com função "${role.toUpperCase()}"`);
      await loadData();
      (e.target as HTMLFormElement).reset();
    }
  };

  const deleteUser = async (userId: string) => {
    if (!supabase) return;
    if (user?.role !== 'admin') {
      alert("Acesso negado: Apenas administradores podem gerenciar usuários.");
      return;
    }
    if (confirm('Deseja realmente excluir este usuário?')) {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) {
        alert(`Erro ao excluir: ${error.message}`);
      } else {
        logActivity('Excluiu Usuário', `Removeu conta de usuário ID: ${userId}`);
        loadData();
      }
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Deseja realmente limpar todos os logs de atividades do sistema?')) return;
    
    setActivityLogs([]);
    localStorage.removeItem('civa_activity_logs');
    
    if (supabase) {
      try {
        await supabase.from('activity_logs').delete().neq('id', 'placeholder-uuid-never-matching');
      } catch (e) {
        console.warn('[CIVA] Tabela activity_logs não existe ou erro de RLS no Supabase. Os logs foram limpos localmente.');
      }
    }
    
    alert('Histórico de logs limpo com sucesso!');
  };

  const handleFixAllLinks = async () => {
    if (!selectedSecretariat) return;
    setIsExpandingLinks(true);
    const secsLocs = locations.filter(l => l.secretariatId === selectedSecretariat.id);
    const newLocs = [...locations];
    let changed = false;

    const promises = secsLocs.map(async (loc) => {
      if (!loc.mapsLink) return null;
      
      // Try to extract coords - if failed or if it's a short link, try to expand
      const hasCoords = extractCoordsFromGoogleMapsLink(loc.mapsLink);
      const isShort = loc.mapsLink.includes('maps.app.goo.gl') || loc.mapsLink.includes('goo.gl/maps');
      
      if (!hasCoords || isShort) {
        try {
          const resp = await fetch(`/api/expand-link?url=${encodeURIComponent(loc.mapsLink)}`);
          if (!resp.ok) return null;
          const data = await resp.json();
          if (data.finalUrl && data.finalUrl !== loc.mapsLink) {
            return { id: loc.id, finalUrl: data.finalUrl };
          }
        } catch (err) {
          console.error("Error expanding link for", loc.name, err);
        }
      }
      return null;
    });

    const results = await Promise.all(promises);
    results.forEach(res => {
      if (res) {
        const index = newLocs.findIndex(l => l.id === res.id);
        if (index !== -1) {
          newLocs[index] = { ...newLocs[index], mapsLink: res.finalUrl };
          changed = true;
        }
      }
    });

    if (changed) {
      const updates = newLocs
        .filter(l => results.some(r => r && r.id === l.id))
        .map(l => ({
          id: l.id,
          name: l.name,
          ip: l.ip,
          server: l.server,
          secretariat_id: l.secretariatId,
          sub_secretariat: l.subSecretariat,
          maps_link: l.mapsLink,
          cameras: l.cameras
        }));

      if (supabase) {
        await supabase.from('locations').upsert(updates);
      }
      alert('Processamento concluído! Verifique o mapa para ver as atualizações.');
    } else {
      alert('Todos os links já estão processados ou não foram encontradas novas coordenadas.');
    }
    setIsExpandingLinks(false);
  };

  const mappedLocations = useMemo(() => {
    return locations.map(loc => ({
      location: loc,
      coords: extractCoordsFromGoogleMapsLink(loc.mapsLink || '')
    })).filter(item => item.coords !== null) as { location: Location, coords: { lat: number, lng: number } }[];
  }, [locations]);

  const unmappedLocations = useMemo(() => {
    return locations.filter(loc => loc.mapsLink && !extractCoordsFromGoogleMapsLink(loc.mapsLink));
  }, [locations]);

  useEffect(() => {
    const expandShortLinksOnMap = async () => {
      const shortLinks = locations.filter(l => l.mapsLink && (l.mapsLink.includes('maps.app.goo.gl') || l.mapsLink.includes('goo.gl/maps')));
      if (shortLinks.length === 0) return;

      setIsExpandingLinks(true);
      const newLocs = [...locations];
      let changed = false;

      const promises = shortLinks.map(async (loc) => {
        try {
          const resp = await fetch(`/api/expand-link?url=${encodeURIComponent(loc.mapsLink!)}`);
          if (!resp.ok) return null;
          const data = await resp.json();
          if (data.finalUrl && data.finalUrl !== loc.mapsLink) {
            return { id: loc.id, finalUrl: data.finalUrl };
          }
        } catch (err) {
          console.error("Error expanding link for", loc.name, err);
        }
        return null;
      });

      const results = await Promise.all(promises);
      results.forEach(res => {
        if (res) {
          const index = newLocs.findIndex(l => l.id === res.id);
          if (index !== -1) {
            newLocs[index] = { ...newLocs[index], mapsLink: res.finalUrl };
            changed = true;
          }
        }
      });

      if (changed) {
        const updates = newLocs
          .filter(l => results.some(r => r && r.id === l.id))
          .map(l => ({
            id: l.id,
            name: l.name,
            ip: l.ip,
            server: l.server,
            secretariat_id: l.secretariatId,
            sub_secretariat: l.subSecretariat,
            maps_link: l.mapsLink,
            cameras: l.cameras
          }));

        if (supabase) {
          await supabase.from('locations').upsert(updates);
        }
      }
      setIsExpandingLinks(false);
    };

    if (currentView === 'map') {
      expandShortLinksOnMap();
    }
  }, [currentView, locations]);

  if (authLoading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/20 blur-[120px] rounded-full"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-800/50 backdrop-blur-3xl border border-slate-700/50 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl relative z-10"
        >
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-600/40 transform rotate-6 border-4 border-slate-800">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase italic mb-2">Acesso Restrito</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">CIVA - Gestão Vigilância Aquiraz</p>
            {!supabase && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <CloudOff className="w-3 h-3 text-amber-500" />
                <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Modo Offline (Sem Sincronização)</span>
              </div>
            )}
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Usuário</label>
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <input 
                  type="text" 
                  name="username"
                  required
                  placeholder="Seu usuário"
                  className="w-full bg-slate-900/50 border border-slate-700 text-slate-100 pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold text-sm placeholder:text-slate-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <input 
                  type="password" 
                  name="password"
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-900/50 border border-slate-700 text-slate-100 pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold text-sm placeholder:text-slate-700"
                />
              </div>
            </div>

            {loginError && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center"
              >
                {loginError}
              </motion.div>
            )}

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98] uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              Entrar no Sistema
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-8 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-50">
            Aquiraz • Segurança Eletrônica • {new Date().getFullYear()}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      {/* Top Header */}
      <header className="bg-blue-900 text-white border-b border-blue-950 flex-none z-40 shadow-xl">
        <div className="h-14 px-4 flex items-center gap-6">
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-blue-300" />
              <div className="hidden lg:block">
                <h1 className="text-sm font-bold tracking-tight">CIVA - VIGILÂNCIA AQUIRAZ</h1>
                <p className="text-[9px] text-blue-400 uppercase font-black tracking-widest leading-none">Gestão Centralizada de Ativos</p>
              </div>
            </div>
            {currentView !== 'dashboard' && (
              <button 
                onClick={() => {
                  if (currentView === 'cameras') setCurrentView('locations');
                  else if (currentView === 'locations') setCurrentView('dashboard');
                  else setCurrentView('dashboard');
                }}
                className="flex items-center gap-2 px-3 py-1 bg-blue-800 hover:bg-blue-700 rounded-lg text-xs font-bold transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </button>
            )}
          </div>
          
          {/* Search Input - Expanded */}
          <div className="flex-1 relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-blue-400" />
            <input 
              type="text" 
              placeholder="PROCURAR LOCAIS, IPS, CÂMERAS..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-blue-950/50 border border-blue-800 text-blue-100 text-[10px] font-bold tracking-widest pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full placeholder:text-blue-700 transition-all font-mono"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-0.5 hover:bg-blue-800 rounded-md transition-colors"
              >
                <X className="w-3 h-3 text-blue-400" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <nav className="hidden md:flex items-center gap-4">
              {/* Sync Status Icon & Manual Sync */}
              <div className="relative group/sync">
                <button 
                  onClick={loadData}
                  disabled={syncStatus === 'syncing'}
                  className={`flex items-center gap-2 px-2 py-1 rounded-lg border transition-all hover:scale-105 active:scale-95 ${
                    syncStatus === 'syncing' ? 'bg-blue-800/50 border-blue-700' : 
                    syncStatus === 'synced' ? 'bg-emerald-900/50 border-emerald-700/50' : 
                    syncStatus === 'error' ? 'bg-rose-900/50 border-rose-700/50' : 'bg-transparent border-transparent'
                  }`}
                >
                  {syncStatus === 'syncing' && <RefreshCw className="w-3.5 h-3.5 text-blue-300 animate-spin" />}
                  {syncStatus === 'synced' && <Cloud className="w-3.5 h-3.5 text-emerald-400" />}
                  {syncStatus === 'error' && <CloudOff className="w-3.5 h-3.5 text-rose-400" />}
                  {syncStatus === 'idle' && <CloudOff className="w-3.5 h-3.5 text-blue-700" />}
                  <span className="text-[8px] font-black text-white/50 uppercase tracking-widest hidden lg:block">Status Nuvem</span>
                </button>
                {syncStatus === 'error' && syncErrorMessage && (
                  <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-white rounded-xl shadow-2xl border border-rose-100 z-50 opacity-0 invisible group-hover/sync:opacity-100 group-hover/sync:visible transition-all">
                    <p className="text-[10px] font-black text-rose-600 uppercase mb-1 flex items-center gap-2">
                       <AlertCircle className="w-3 h-3" /> Erro de Sincronização
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium leading-relaxed">{syncErrorMessage}</p>
                  </div>
                )}
              </div>
            </nav>
            <div className="h-8 w-px bg-blue-800"></div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-tighter leading-none">{user?.username}</p>
                <p className="text-[8px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">ADMIN</p>
              </div>
              <div className="relative group">
                <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold border border-blue-600 overflow-hidden shadow-lg group-hover:bg-blue-600 transition-colors">
                  <UserIcon className="w-5 h-5 text-blue-100" />
                </div>
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-50">
                    <p className="text-[10px] font-black text-slate-900 uppercase">Ações do Perfil</p>
                  </div>
                  <button 
                    onClick={() => {
                      if (confirm('Deseja limpar os dados locais e recarregar? Isso pode resolver problemas de sincronização.')) {
                        localStorage.removeItem('civa_secretariats');
                        localStorage.removeItem('civa_locations');
                        localStorage.removeItem('civa_logs');
                        window.location.reload();
                      }
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-600 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Resetar Dados Locais</span>
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sair do Sistema</span>
                  </button>
                  {deferredPrompt && (
                    <div className="px-2 py-1.5 border-t border-slate-100 bg-emerald-50/20">
                      <button 
                        onClick={handleInstallClick}
                        className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm shadow-emerald-500/10 active:scale-[0.98]"
                      >
                        <Download className="w-3.5 h-3.5 text-white animate-bounce" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Instalar PWA</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* New Navigation Bar below Blue Strip */}
        <div className="bg-blue-800 border-t border-blue-700/50 px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => handleSelectView('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${currentView === 'dashboard' || currentView === 'locations' || currentView === 'cameras' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-100 hover:bg-blue-700'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Home
          </button>
          <button 
            onClick={() => handleSelectView('map')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${currentView === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-100 hover:bg-blue-700'}`}
          >
            <MapIcon className="w-4 h-4" /> Mapa
          </button>
          <button 
            onClick={() => handleSelectView('history')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${currentView === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-100 hover:bg-blue-700'}`}
          >
            <History className="w-4 h-4" /> Histórico
          </button>
          <button 
            onClick={handleReportsView}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${currentView === 'reports' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-100 hover:bg-blue-700'}`}
          >
            <AlertTriangle className="w-4 h-4" /> Relatórios
          </button>
          {user?.role === 'admin' && (
            <>
              <button 
                onClick={() => setCurrentView('users')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${currentView === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-100 hover:bg-blue-700'}`}
              >
                <Users className="w-4 h-4" /> Usuários
              </button>
              <button 
                onClick={() => setCurrentView('logs')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${currentView === 'logs' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-100 hover:bg-blue-700'}`}
              >
                <Terminal className="w-4 h-4" /> Logs
              </button>
            </>
          )}
        </div>
      </header>


      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 relative">
          <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto min-h-full">
            <AnimatePresence mode="wait">
          
          {/* Search Results View - Only show if in dashboard or specific views that don't have internal filter */}
          {currentView === 'dashboard' && searchQuery.trim() !== '' && filteredResults && (
            <motion.div 
              key="search-results"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <Search className="w-6 h-6 text-blue-600" />
                    RESULTADOS DA BUSCA: "{searchQuery.toUpperCase()}"
                  </h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                    {(filteredResults.secretariats.length + filteredResults.locations.length + filteredResults.cameras.length) === 0 
                      ? 'Nenhum resultado encontrado' 
                      : `${filteredResults.secretariats.length + filteredResults.locations.length + filteredResults.cameras.length} itens encontrados`}
                  </p>
                </div>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
                >
                  Fechar Busca
                </button>
              </div>

              {/* Secretariats Results */}
              {filteredResults.secretariats.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Secretarias</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {filteredResults.secretariats.map(sec => {
                      const Icon = IconMap[sec.icon] || Building2;
                      return (
                        <button 
                          key={sec.id}
                          onClick={() => { handleSelectSecretariat(sec); setSearchQuery(''); }}
                          className="w-full bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 hover:border-blue-300 transition-all text-left flex items-center gap-4"
                        >
                          <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                            <Icon className="w-6 h-6" />
                          </div>
                          <h4 className="font-extrabold text-slate-800 uppercase tracking-tighter text-sm line-clamp-1">{sec.name}</h4>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Locations Results */}
              {filteredResults.locations.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Unidades / Locais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredResults.locations.map(loc => (
                      <div 
                        key={loc.id}
                        onClick={() => { handleSelectLocation(loc); setSearchQuery(''); }}
                        className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="bg-slate-50 p-3 rounded-2xl text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            <Building2 className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm group-hover:text-blue-900">{loc.name}</h4>
                            <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mt-0.5">
                              <span className="text-blue-600 font-mono tracking-normal">{loc.ip}</span> • {loc.cameras.length} CÂMERAS
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {loc.mapsLink && (
                            <a 
                              href={loc.mapsLink} 
                              target="_blank" 
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2.5 bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded-xl transition-all"
                              title="Ver Mapa"
                            >
                              <MapIcon className="w-4 h-4" />
                            </a>
                          )}
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setReportingLocProblem(loc);
                              setSearchQuery(''); 
                            }}
                            className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            title="Reportar Problema Geral"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                          <div className="text-slate-200 group-hover:text-blue-600 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Camera Results */}
              {filteredResults.cameras.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Câmeras / IPs Específicos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredResults.cameras.map(cam => (
                      <div 
                        key={`${cam.location.id}-${cam.id}`}
                        onClick={() => { handleSelectLocation(cam.location); setSearchQuery(''); }}
                        className={`p-5 rounded-3xl border transition-all duration-500 cursor-pointer flex flex-col gap-3 group bg-[#B9D9EB] border-white/20 shadow-2xl shadow-blue-900/10 hover:shadow-blue-400/40 hover:-translate-y-2`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="bg-white p-2 rounded-xl text-slate-400 transition-colors group-hover:bg-blue-50 shadow-sm">
                            <Video className="w-5 h-5 transition-colors group-hover:text-blue-600" />
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${cam.status === CameraStatus.ONLINE ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {cam.status === CameraStatus.ONLINE ? 'ONLINE' : 'ERRO'}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800 uppercase text-lg italic tracking-tighter leading-none mb-1">CAM {cam.number}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase line-clamp-1">{cam.location.name}</p>
                        </div>
                        <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <a 
                              href={`http://${cam.location.ip}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[9px] font-mono text-blue-600 font-bold hover:underline"
                              title="Acessar NVR"
                            >
                              {cam.location.ip}
                            </a>
                            {cam.location.mapsLink && (
                               <a 
                                 href={cam.location.mapsLink} 
                                 target="_blank" 
                                 rel="noreferrer"
                                 onClick={(e) => e.stopPropagation()}
                                 className="text-green-600 hover:text-green-700 transition-colors"
                                 title="Ver no Google Maps"
                               >
                                 <MapIcon className="w-2.5 h-2.5" />
                               </a>
                            )}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(filteredResults.secretariats.length + filteredResults.locations.length + filteredResults.cameras.length) === 0 && (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">CIVA não encontrou correspondências</h3>
                  <p className="text-sm text-slate-500 mt-1">Tente conferir o IP ou o nome da unidade.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Dashboard */}
          {currentView === 'dashboard' && searchQuery.trim() === '' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-800">Monitoramento por Secretaria</h2>
                  {user?.role === 'admin' && (
                    <button 
                      onClick={() => setIsAddingSec(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                    >
                      <Plus className="w-4 h-4" /> Nova Secretaria
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {secretariats.map(sec => {
                    const Icon = IconMap[sec.icon] || Building2;
                    const secLocations = locations.filter(l => l.secretariatId === sec.id);
                    const totalCameras = secLocations.reduce((acc, loc) => acc + loc.cameras.length, 0);
                    const errorCount = secLocations.reduce((acc, loc) => acc + loc.cameras.filter(c => c.status === CameraStatus.ERROR).length, 0);

                    return (
                      <div key={sec.id} className="relative group">
                        <button 
                          onClick={() => handleSelectSecretariat(sec)}
                          className={`w-full p-6 rounded-3xl border transition-all duration-500 text-left relative overflow-hidden bg-[#B9D9EB] border-white/20 shadow-2xl shadow-blue-900/10 hover:shadow-blue-400/40 hover:-translate-y-3 group`}
                        >
                           {errorCount > 0 && (
                            <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-black px-2.5 py-1 rounded-bl-xl shadow-sm animate-pulse z-10">
                              {errorCount} ALERTAS
                            </div>
                          )}
                          <div className={`transition-all duration-300 w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-sm group-hover:scale-110 ${
                            errorCount > 0 ? 'bg-white text-rose-600' : 
                            totalCameras > 0 ? 'bg-white text-emerald-600' : 
                            'bg-white text-blue-600'
                          }`}>
                            <Icon className="w-7 h-7 transition-colors" />
                          </div>
                          <h3 className="font-extrabold text-slate-800 mb-1 group-hover:text-blue-900 transition-colors uppercase tracking-tighter">{sec.name}</h3>
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">{secLocations.length} UNIDADES</p>
                            <span className="text-[10px] text-slate-300">•</span>
                            <p className="text-[11px] text-blue-600 font-black uppercase tracking-tight">{totalCameras} CÂMERAS</p>
                          </div>
                        </button>
                        
                        {user?.role === 'admin' && (
                          <div className="absolute top-2 left-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setIsEditingSec(sec); }}
                              className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-lg shadow-sm transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setDeletingItem({ type: 'sec', id: sec.id, name: sec.name }); 
                              }}
                              className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg shadow-sm transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-800">Status Geral</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div id="stat-total" className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-5 transition-all hover:shadow-md">
                    <div className="bg-white p-4 rounded-xl shadow-sm">
                      <Video className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-900/60">Total de Câmeras</p>
                      <p className="text-3xl font-black text-blue-900">{stats.total}</p>
                    </div>
                  </div>
                  <div id="stat-online" className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-5 transition-all hover:shadow-md">
                    <div className="bg-white p-4 rounded-xl shadow-sm">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-900/60">Câmeras Online</p>
                      <p className="text-3xl font-black text-emerald-600">{stats.online}</p>
                    </div>
                  </div>
                  <div id="stat-error" className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm flex items-center gap-5 transition-all hover:shadow-md">
                    <div className="bg-white p-4 rounded-xl shadow-sm">
                      <AlertTriangle className="w-8 h-8 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-rose-900/60">Com Problema</p>
                      <p className="text-3xl font-black text-rose-600">{stats.error}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Dynamic Dashboard Extras: Indicators 1 & 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 1. Camera Operational Efficiency Gauge (Col span 5) */}
                <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                      <HeartPulse className="w-4 h-4 text-emerald-500" />
                      EFICIÊNCIA OPERACIONAL DO CIVA
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
                      Métrica consolidada de disponibilidade de canais CCTV em toda a rede de monitoramento de Aquiraz.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
                    {/* SVG Radial Progress Circle */}
                    <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                      {/* Outer Ring Background */}
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="72"
                          cy="72"
                          r="62"
                          stroke="#f1f5f9"
                          strokeWidth="12"
                          fill="transparent"
                          className="transition-all"
                        />
                        {/* Dynamic Progress Fill */}
                        <circle
                          cx="72"
                          cy="72"
                          r="62"
                          stroke={stats.error > 0 ? (stats.error > stats.total * 0.2 ? '#f43f5e' : '#f59e0b') : '#10b981'}
                          strokeWidth="12"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 62}
                          strokeDashoffset={
                            2 * Math.PI * 62 * (1 - (stats.total > 0 ? stats.online / stats.total : 1))
                          }
                          strokeLinecap="round"
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      {/* Percent Tag inside Circle */}
                      <div className="absolute text-center mt-1">
                        <p className="text-3xl font-black text-slate-800 font-mono tracking-tight">
                          {stats.total > 0 ? Math.round((stats.online / stats.total) * 100) : 100}%
                        </p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">ESTÁVEL</p>
                      </div>
                    </div>

                    {/* Quick Analytics Metadata */}
                    <div className="space-y-4 w-full sm:w-auto">
                      <div className="border-l-4 border-emerald-500 pl-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Canais Ativos</p>
                        <p className="text-base font-extrabold text-slate-800">{stats.online} / {stats.total} Links</p>
                      </div>
                      <div className="border-l-4 border-rose-500 pl-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Incidentes</p>
                        <p className="text-base font-extrabold text-slate-800">{stats.error} Câmeras Off</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center border border-slate-100">
                        SLA Recomendado &gt; 95%
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Métrica Geral em Tempo Real</span>
                    <span className="text-emerald-600">✓ Ativo</span>
                  </div>
                </div>

                {/* 2. Compact System Activity Logs Audit Feed (Col span 7) */}
                <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-indigo-500" />
                        AUDITORIA E ATIVIDADES DA CENTRAL
                      </h3>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => setCurrentView('logs')}
                          className="text-[9px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Ver Histórico Completo
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
                      Atividade operacional recente realizada por usuários cadastrados nos servidores do CIVA.
                    </p>
                  </div>

                  {/* Feed Items */}
                  <div className="space-y-3.5 flex-1 flex flex-col justify-center">
                    {activityLogs.length > 0 ? (
                      activityLogs.slice(0, 4).map((log, index) => {
                        const isDeletion = log.action.toLowerCase().includes('excluiu') || log.action.toLowerCase().includes('deletar');
                        const isSuccess = log.action.toLowerCase().includes('login') || log.action.toLowerCase().includes('resolveu') || log.action.toLowerCase().includes('adicionou');
                        return (
                          <div 
                            key={log.id || index} 
                            className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3 flex items-start gap-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                              isDeletion ? 'bg-rose-500' :
                              isSuccess ? 'bg-emerald-500' :
                              'bg-indigo-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                <span className="text-[10px] font-extrabold text-slate-800 uppercase block truncate">
                                  {log.username}
                                </span>
                                <span className="text-[9px] font-semibold text-slate-400 font-mono">
                                  {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] font-semibold text-slate-600 leading-normal uppercase tracking-wide truncate">
                                <span className="text-indigo-600 mr-1.5">[{log.action}]</span> {log.details}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-6 text-center text-slate-400 flex flex-col items-center justify-center">
                        <Terminal className="w-8 h-8 text-slate-200 mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">Nenhuma atividade registrada ainda</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Atualizado Instantaneamente</span>
                    <span>Total: {activityLogs.length}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Locations Drilldown View */}
          {currentView === 'locations' && selectedSecretariat && searchQuery.trim() === '' && (
            <motion.div 
              key="locations"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Sync Error Alert */}
              {syncStatus === 'error' && (
                <div className="mb-8 p-6 bg-rose-50 border-2 border-rose-200 rounded-3xl flex items-start gap-4 shadow-xl shadow-rose-900/5 animate-in fade-in slide-in-from-top-4">
                  <CloudOff className="w-8 h-8 text-rose-500 shrink-0" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-rose-900 font-black uppercase tracking-tight text-lg">Erro na Nuvem</h4>
                      <span className="px-2 py-0.5 bg-rose-200 text-rose-800 text-[10px] font-black rounded-full">ACTION REQUIRED</span>
                    </div>
                    <p className="text-rose-700 text-sm font-medium leading-relaxed">
                      {syncErrorMessage || 'Ocorreu um erro ao tentar conectar com o Supabase.'}
                    </p>
                    <div className="pt-3 flex gap-3">
                      <button 
                        onClick={loadData}
                        className="px-5 py-2 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/30 flex items-center gap-2"
                      >
                       <RefreshCw className="w-3 h-3" /> Tentar Novamente
                      </button>
                      <a 
                        href="https://supabase.com/dashboard" 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-5 py-2 bg-white text-rose-600 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-50 transition-colors"
                      >
                        Abrir Painel Supabase
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setCurrentView('dashboard')}
                  className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-all text-slate-600"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">{selectedSecretariat.name}</h2>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Unidades de Atendimento</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {user?.role === 'admin' && (
                    <>
                      <button 
                        onClick={handleFixAllLinks}
                        disabled={isExpandingLinks}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-100 text-emerald-700 rounded-2xl text-sm font-bold hover:bg-emerald-200 transition-all disabled:opacity-50"
                      >
                        {isExpandingLinks ? (
                          <div className="w-4 h-4 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <MapPin className="w-5 h-5" />
                        )}
                        Mapear Links
                      </button>
                      <button 
                        onClick={() => setIsAddingLoc(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20"
                      >
                        <Plus className="w-5 h-5" /> Novo Local
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Sub-Secretariat Tabs */}
              {(selectedSecretariat.id === 'educacao' || selectedSecretariat.id === 'saude') && (
                <div className="flex flex-wrap gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
                  {(selectedSecretariat.id === 'educacao' 
                    ? ['ESCOLAS', 'CRECHES', 'OUTROS LOCAIS'] 
                    : ['POSTOS DE SAÚDE', 'HOSPITAL', 'OUTROS LOCAIS']
                  ).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSelectedTab(tab)}
                      className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        selectedTab === tab 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {locations
                  .filter(l => l.secretariatId === selectedSecretariat.id)
                  .filter(l => {
                    if (!selectedTab) return true;
                    // If the loc has no subSecretariat but we have a tab, it might be in "OUTROS LOCAIS" if that tab exists
                    const locSub = l.subSecretariat || 'OUTROS LOCAIS';
                    return locSub === selectedTab;
                  })
                  .map(loc => {
                  const errors = loc.cameras.filter(c => c.status === CameraStatus.ERROR).length;
                  return (
                    <div key={loc.id} className="relative group">
                      <div 
                        onClick={() => handleSelectLocation(loc)}
                        className={`w-full p-8 rounded-[2.5rem] border transition-all duration-500 text-left relative overflow-hidden cursor-pointer bg-[#B9D9EB] border-white/20 shadow-2xl shadow-blue-900/10 hover:shadow-blue-400/40 hover:-translate-y-3`}
                      >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform shadow-sm bg-white group-hover:scale-110 ${
                          errors > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          <Building2 className="w-7 h-7" />
                        </div>
                        
                        <h3 className="font-black text-slate-800 text-xl mb-2 line-clamp-2 uppercase tracking-tighter leading-tight group-hover:text-blue-900">{loc.name}</h3>
                        
                        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-50 mt-4">
                          <div className="flex items-center gap-2">
                            <Video className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold text-slate-500 uppercase">{loc.cameras.length} CAM</span>
                          </div>
                          {loc.mapsLink && (
                            <div className="flex items-center gap-2">
                              <MapIcon className="w-4 h-4 text-green-600" />
                              <a 
                                href={loc.mapsLink} 
                                target="_blank" 
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10px] font-bold text-green-600 hover:underline uppercase"
                                title="Ver no Google Maps"
                              >
                                Ver Mapa
                              </a>
                            </div>
                          )}
                          {!loc.mapsLink && user?.role === 'admin' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setIsEditingLoc(loc); }}
                              className="flex items-center gap-2 text-[10px] font-bold text-blue-600 hover:bg-white/50 px-2 py-0.5 rounded uppercase transition-colors"
                              title="Adicionar Link do Google Maps"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Link Mapa
                            </button>
                          )}
                          <div className="flex items-center gap-2">
                            <LayoutDashboard className="w-4 h-4 text-slate-400" />
                            <a 
                              href={`http://${loc.ip}`} 
                              target="_blank" 
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg uppercase hover:bg-blue-600 hover:text-white transition-all cursor-pointer underline decoration-blue-600/30 hover:no-underline shadow-sm"
                              title="Acessar Link NVR"
                            >
                              IP: {loc.ip}
                            </a>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setReportingLocProblem(loc); }}
                            className="ml-auto p-2 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Reportar Problema Geral"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                          {errors > 0 && (
                            <div className="flex items-center gap-2 bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {errors} ALERTAS
                            </div>
                          )}
                        </div>
                        <div className="absolute top-8 right-8 p-3 rounded-full bg-slate-50 text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all transform translate-x-2 group-hover:translate-x-0">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>

                      {user?.role === 'admin' && (
                        <div className="absolute top-4 left-4 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setIsEditingLoc(loc); }}
                            className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-xl shadow-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setDeletingItem({ type: 'loc', id: loc.id, name: loc.name }); 
                            }}
                            className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-xl shadow-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Camera View */}
          {currentView === 'cameras' && selectedLocation && searchQuery.trim() === '' && (
            <motion.div 
              key="cameras"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm shadow-slate-100">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-xl shadow-blue-900/20">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedLocation.name}</h2>
                    <div className="flex items-center gap-3 mt-1.5">
                      <a 
                        href={`http://${selectedLocation.ip}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm hover:bg-blue-600 hover:text-white transition-all underline decoration-blue-600/30 hover:no-underline"
                        title="Acessar NVR"
                      >
                        IP REDE: {selectedLocation.ip}
                      </a>
                      <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-tight">SRV: {selectedLocation.server}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 h-fit">
                   {user?.role === 'admin' && (
                     <>
                       <button 
                        onClick={() => setIsEditingLoc(selectedLocation)}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                        title="Editar Unidade"
                      >
                        <Edit3 className="w-4 h-4" /> 
                       </button>
                       <button 
                        onClick={() => setDeletingItem({ type: 'loc', id: selectedLocation.id, name: selectedLocation.name })}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-rose-500 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-50 transition-all shadow-sm"
                        title="Excluir Unidade"
                      >
                        <Trash2 className="w-4 h-4" />
                       </button>
                       <button 
                        onClick={() => addCamera(selectedLocation.id)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all"
                      >
                        <Plus className="w-4 h-4" /> Nova Câmera
                      </button>
                     </>
                   )}
                   <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4" />
                    {selectedLocation.cameras.filter(c => c.status === CameraStatus.ONLINE).length} ONLINE
                  </div>
                  <div className="flex items-center gap-2 bg-rose-50 text-rose-700 px-4 py-2 rounded-xl text-xs font-bold border border-rose-100">
                    <AlertTriangle className="w-4 h-4" />
                    {selectedLocation.cameras.filter(c => c.status === CameraStatus.ERROR).length} ERROS
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {selectedLocation.cameras.map(cam => (
                  <div 
                    id={`cam-card-${cam.id}`}
                    key={cam.id}
                    className={`relative p-8 rounded-[2rem] border transition-all duration-500 group bg-[#B9D9EB] border-white/20 shadow-2xl shadow-blue-900/10 hover:shadow-blue-400/40 hover:-translate-y-3`}
                  >
                    <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase tracking-widest ${cam.status === CameraStatus.ONLINE ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white animate-pulse'}`}>
                      {cam.status === CameraStatus.ONLINE ? 'ONLINE' : 'ERRO'}
                    </div>
                    {user?.role === 'admin' && (
                      <button 
                        onClick={() => setDeletingItem({ type: 'cam', id: cam.id, extraId: selectedLocation.id, name: `Câmera ${cam.number}` })}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="flex items-center justify-between mb-8">
                      <div className={`p-4 rounded-2xl ${cam.status === CameraStatus.ONLINE ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-600 text-white shadow-lg shadow-rose-600/40'}`}>
                        <Video className="w-6 h-6" />
                      </div>
                      <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                        cam.status === CameraStatus.ONLINE ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {cam.status === CameraStatus.ONLINE ? 'Ativo' : 'Offline'}
                      </div>
                    </div>
                    
                    <h4 className="font-black text-slate-900 text-2xl leading-none uppercase tracking-tighter italic">CAM {cam.number}</h4>
                    <p className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-[0.2em]">{selectedLocation.id.toUpperCase()}-00{cam.number}</p>

                    <div className="mt-10">
                      {cam.status === CameraStatus.ONLINE ? (
                        <button 
                          onClick={() => setReportingCamProblem({ locationId: selectedLocation.id, camera: cam })}
                          className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group-hover:bg-slate-200"
                        >
                          <AlertCircle className="w-4 h-4" /> Reportar Falha
                        </button>
                      ) : (
                        <button 
                          onClick={() => setRepairingCamera({ locationId: selectedLocation.id, camera: cam })}
                          className="w-full py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 shadow-2xl shadow-rose-600/30 transition-all duration-300 flex items-center justify-center gap-2"
                        >
                          <Wrench className="w-4 h-4" /> Realizar Reparo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Reports */}
          {currentView === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4 italic uppercase">
                    <span className="bg-rose-600 text-white p-2 rounded-xl not-italic"><AlertTriangle className="w-8 h-8" /></span>
                    Manutenção Pendente
                  </h2>
                  <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs mt-2 ml-1">Relatório simplificado para equipe técnica</p>
                </div>
                
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => {
                        const inventory = secretariats.map(sec => {
                          const secLocs = locations.filter(l => l.secretariatId === sec.id);
                          const total = secLocs.reduce((acc, loc) => acc + loc.cameras.length, 0);
                          const online = secLocs.reduce((acc, loc) => acc + loc.cameras.filter(c => c.status === CameraStatus.ONLINE).length, 0);
                          const offline = total - online;
                          return { name: sec.name, total, online, offline };
                        });

                        const text = [
                          `*Inventário de Câmeras por Secretaria - CIVA*`,
                          `*Data:* ${new Date().toLocaleDateString('pt-BR')}`,
                          `------------------------------------------`,
                          ...inventory.map(item => 
                            `*${item.name.toUpperCase()}*\n• Total: ${item.total}\n• Online: ${item.online}\n• Offline: ${item.offline}`
                          ),
                          `------------------------------------------`,
                          `*Total Geral:* ${stats.total} câmeras`
                        ].join('\n\n');
                        handleCopyReport(text);
                      }}
                      className="px-6 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2"
                    >
                      <Video className="w-4 h-4" /> Copiar Inventário
                    </button>
                    <button 
                      onClick={() => setIsSelectingLocForReport(true)}
                      className="px-6 py-4 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4" /> Reportar Problema Geral
                    </button>
                    <button 
                      onClick={() => {
                      const problemLocations = locations.filter(l => l.cameras.some(c => c.status === CameraStatus.ERROR));
                      
                      const text = [
                        `*Relatório de Manutenção - CIVA Aquiraz*`,
                        `*Data:* ${new Date().toLocaleDateString('pt-BR')}`,
                        `------------------------------------------`,
                        ...problemLocations.map((loc, index) => {
                          const isGeneral = loc.cameras.every(c => c.status === CameraStatus.ERROR);
                          if (isGeneral) {
                            const lastLog = maintenanceLogs
                              .filter(l => l.locationId === loc.id)
                              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                            return `${index + 1}. *${loc.name}*\n   - STATUS: [LOCAL FORA DE OPERAÇÃO]\n   - IP: ${loc.ip}\n   - MOTIVO: ${lastLog ? lastLog.descricaoTecnica.replace('FALHA REPORTADA: ', '') : 'Não informado'}`;
                          } else {
                            const errorCams = loc.cameras.filter(c => c.status === CameraStatus.ERROR);
                            const camsInfo = errorCams.map(c => {
                              const log = maintenanceLogs
                                .filter(l => l.locationId === loc.id && l.cameraId === c.id)
                                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                              return `     • CAM ${c.number}: ${log ? log.descricaoTecnica.replace('FALHA REPORTADA: ', '') : 'Sem motivo'}`;
                            }).join('\n');
                            return `${index + 1}. *${loc.name}*\n   - IP: ${loc.ip}\n${camsInfo}`;
                          }
                        }),
                        `------------------------------------------`,
                        `*Locais com Pendência:* ${problemLocations.length}`
                      ].join('\n\n');
                      
                      handleCopyReport(text);
                    }}
                    className="px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Copiar p/ WhatsApp
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Imprimir
                  </button>
                </div>
              </div>
              
              {/* Secretariat Inventory Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {secretariats.map(sec => {
                  const secLocs = locations.filter(l => l.secretariatId === sec.id);
                  const total = secLocs.reduce((acc, loc) => acc + loc.cameras.length, 0);
                  const online = secLocs.reduce((acc, loc) => acc + loc.cameras.filter(c => c.status === CameraStatus.ONLINE).length, 0);
                  const offline = total - online;
                  
                  return (
                    <div key={sec.id} className="bg-[#B9D9EB] p-5 rounded-3xl border border-white/20 shadow-xl shadow-blue-900/10 hover:shadow-blue-400/30 transition-all hover:-translate-y-1 flex items-center gap-4">
                      <div className="bg-slate-50 w-10 h-10 rounded-xl flex items-center justify-center text-slate-400">
                        {sec.icon && IconMap[sec.icon] ? React.createElement(IconMap[sec.icon], { size: 20 }) : <Building2 size={20} />}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-[10px] font-black text-blue-900/50 uppercase tracking-widest leading-none mb-1 line-clamp-1">{sec.name}</h4>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-black text-blue-950 leading-none">{total}</span>
                          <span className="text-[9px] font-bold text-blue-900/60 uppercase">Câmeras</span>
                        </div>
                      </div>
                      <div className="text-right">
                         <div className="flex items-center gap-1.5 justify-end text-blue-950">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                            <span className="text-[10px] font-black">{online}</span>
                         </div>
                         <div className="flex items-center gap-1.5 justify-end text-blue-950">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/20"></div>
                            <span className="text-[10px] font-black">{offline}</span>
                         </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(searchQuery.trim() ? filteredResults.locations : locations).filter(l => l.cameras.some(c => c.status === CameraStatus.ERROR)).map(loc => (
                  <div key={loc.id} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-rose-900/5 transition-all">
                    <div className="bg-rose-50 p-6 border-b border-rose-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-rose-600 text-white p-3 rounded-2xl shadow-lg shadow-rose-600/20">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-black text-rose-900 text-lg uppercase tracking-tight">{loc.name}</h3>
                          <p className="text-[10px] font-bold text-rose-500 uppercase flex items-center gap-2">
                             IP TÉCNICO: <span className="font-mono">{loc.ip}</span> • SRV: {loc.server}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            const reportText = `RELATÓRIO CIVA - ${loc.name.toUpperCase()}\nStatus: ${loc.cameras.filter(c => c.status === CameraStatus.ERROR).length} PENDÊNCIAS\nServidor: ${loc.server}\nIP local: ${loc.ip}\n\nCâmeras com Falha:\n${loc.cameras.filter(c => c.status === CameraStatus.ERROR).map(c => `- Câmera ${c.number}`).join('\n')}\n\nGerado em: ${new Date().toLocaleString()}`;
                            handleCopyReport(reportText);
                          }}
                          className="p-2.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-2"
                          title="Copiar Relatório como Texto"
                        >
                          <Copy className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase">Copiar</span>
                        </button>
                        <button 
                          onClick={() => {
                            // Focus on this location's data for printing
                            window.print();
                          }}
                          className="p-2.5 bg-slate-50 text-slate-600 hover:bg-slate-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-2"
                          title="Imprimir este Local"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <span className="text-[10px] font-black text-rose-600 bg-white px-3 py-1 rounded-full shadow-sm border border-rose-100">
                          {loc.cameras.filter(c => c.status === CameraStatus.ERROR).length} PENDÊNCIAS
                        </span>
                      </div>
                    </div>
                    
                      {loc.cameras.every(c => c.status === CameraStatus.ERROR) ? (
                        <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-start gap-4">
                          <div className="bg-amber-500 text-white p-3 rounded-2xl shadow-lg shadow-amber-500/20 shrink-0">
                            <AlertCircle className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight italic">PROBLEMA GERAL NO LOCAL</h4>
                              <span className="text-[10px] font-black text-amber-600 bg-white px-2 py-0.5 rounded shadow-sm border border-amber-100">TODAS AS CÂMERAS FORA</span>
                            </div>
                            <p className="text-xs font-bold text-amber-800 uppercase tracking-tight">
                              {(() => {
                                const lastLog = maintenanceLogs
                                  .filter(l => l.locationId === loc.id)
                                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                return lastLog ? lastLog.descricaoTecnica.replace('FALHA REPORTADA: ', '') : 'Falha total de comunicação';
                              })()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleRepairLocationGeneral(loc.id)}
                              className="p-2.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-2"
                              title="Reparar Tudo no Local"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase">REPARAR GERAL</span>
                            </button>
                            <button 
                              onClick={() => handleSelectLocation(loc)}
                              className="p-2 bg-white rounded-xl border border-amber-200 text-amber-600 hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 space-y-4">
                          {loc.cameras.filter(c => c.status === CameraStatus.ERROR).map(cam => {
                            const lastLog = maintenanceLogs
                              .filter(log => log.locationId === loc.id && log.cameraId === cam.id)
                              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                            
                            return (
                              <div key={cam.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-rose-200 transition-all">
                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-rose-600 shadow-sm border border-slate-100 font-black text-xl italic tracking-tighter">
                                  {cam.number}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">CÂMERA {cam.number}</h4>
                                    <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded shadow-sm">ID: {loc.id.toUpperCase()}-00{cam.number}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-600">
                                    <Edit3 className="w-3.5 h-3.5 text-rose-500" />
                                    <p className="text-xs font-bold uppercase text-slate-600 tracking-tight">
                                      {lastLog ? lastLog.descricaoTecnica.replace('FALHA REPORTADA: ', '') : 'Motivo não especificado'}
                                    </p>
                                  </div>
                                  {lastLog && (
                                    <p className="text-[9px] text-slate-400 mt-2 font-medium flex items-center gap-1.5 grayscale opacity-70">
                                      <History className="w-3 h-3" /> Reportado em: {new Date(lastLog.timestamp).toLocaleString('pt-BR')}
                                    </p>
                                  )}
                                </div>
                                <button 
                                  onClick={() => handleSelectLocation(loc)}
                                  className="self-center p-2 bg-white rounded-xl border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                  </div>
                ))}
                
                {locations.every(l => l.cameras.every(c => c.status === CameraStatus.ONLINE)) && (
                  <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border border-slate-200 border-dashed">
                    <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">TUDO EM ORDEM</h3>
                    <p className="text-slate-500 font-medium mt-2">Nenhuma câmera com falha detectada no momento.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Maintenance Logs View */}
          {currentView === 'history' && searchQuery.trim() === '' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Histórico de Manutenções</h2>
                  <p className="text-slate-500 text-sm">Registros técnicos de reparos realizados nas câmeras.</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black border-b border-slate-100">
                        <th className="px-6 py-4">Data/Hora</th>
                        <th className="px-6 py-4">Equipamento</th>
                        <th className="px-6 py-4">Local / Servidor</th>
                        <th className="px-6 py-4">Descrição Técnica</th>
                        {user?.role === 'admin' && <th className="px-6 py-4 text-center">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {maintenanceLogs.map(log => {
                        const loc = locations.find(l => l.id === log.locationId);
                        return (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-6 py-4">
                              <span className="font-bold text-slate-800">{new Date(log.timestamp).toLocaleDateString()}</span><br/>
                              <span className="text-[10px] text-slate-400 font-bold">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Video className="w-4 h-4 text-emerald-500" />
                                <span className="font-bold text-slate-700">Câmera {log.cameraId === 'GERAL' ? 'GERAL' : log.cameraId}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-800 leading-none mb-1 uppercase tracking-tight">{loc?.name || 'Local Removido'}</p>
                              <p className="text-[10px] text-slate-500 leading-none">IP: {log.ipLocal}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="bg-slate-100 p-3 rounded-xl text-xs text-slate-700 italic border-l-4 border-blue-500 max-w-md">
                                {log.descricaoTecnica}
                              </div>
                            </td>
                            {user?.role === 'admin' && (
                              <td className="px-6 py-4 text-center">
                                <button 
                                  onClick={() => {
                                    if (confirm('Deseja excluir este registro do histórico?')) {
                                      setSyncStatus('syncing');
                                      supabase.from('maintenance_logs').delete().eq('id', log.id).then(({ error }) => {
                                        if (error) {
                                          setSyncStatus('error');
                                          alert(`Erro ao excluir: ${error.message}`);
                                        } else {
                                          setSyncStatus('synced');
                                          loadData();
                                        }
                                      });
                                    }
                                  }}
                                  className="p-2 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                                  title="Excluir Registro"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* User Management View */}
          {currentView === 'users' && user?.role === 'admin' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-3">
                    <ShieldAlert className="w-8 h-8 text-blue-600" />
                    Gestão de Usuários
                  </h2>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Controle de acesso ao sistema CIVA</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Create User Form */}
                <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100 h-fit">
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600" /> Criar Novo Usuário
                   </h3>
                   <form onSubmit={handleUserSubmit} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Usuário</label>
                        <div className="relative">
                          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            name="username" 
                            required 
                            placeholder="Nome de login"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            name="password" 
                            type="password"
                            required 
                            placeholder="••••••••"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nível de Acesso</label>
                        <div className="relative">
                          <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <select 
                            name="role" 
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold appearance-none"
                          >
                            <option value="viewer">Visualizador (Leitura)</option>
                            <option value="admin">Administrador (Total)</option>
                          </select>
                        </div>
                      </div>
                      <button 
                        type="submit"
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
                      >
                        Cadastrar Usuário
                      </button>
                   </form>
                </div>

                {/* Users List */}
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100 overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Usuários Cadastrados</h3>
                    <div className="bg-blue-50 px-3 py-1 rounded-full text-[10px] font-black text-blue-600">
                      {appUsers.length} USUÁRIOS
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {appUsers.map(u => (
                      <div key={u.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${u.role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                            <UserIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">{u.username}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${u.role === 'admin' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'}`}>
                                {u.role === 'admin' ? 'ADMINISTRADOR' : 'VISUALIZADOR'}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase">CRIADO EM {new Date().toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                            onClick={() => deleteUser(u.id!)}
                            disabled={u.username === user.username}
                            className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Excluir Usuário"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* System Audit Activity Logs */}
          {currentView === 'logs' && user?.role === 'admin' && (
            <motion.div 
              key="logs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <SystemActivityLogs 
                logs={activityLogs} 
                onClearLogs={handleClearLogs}
                supabaseConnected={Boolean(supabase)}
              />
            </motion.div>
          )}

          {/* Map View */}
          {currentView === 'map' && (
            <motion.div
              key="map-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-[calc(100vh-160px)] w-full rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-2xl relative"
            >
              {/* Failed Locations Modal */}
              {showUnmappedList && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                  <div 
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    onClick={() => setShowUnmappedList(false)}
                  ></div>
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100"
                  >
                    <div className="bg-rose-600 p-6 text-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6" />
                        <h3 className="text-lg font-black uppercase tracking-widest">Locais não mapeados</h3>
                      </div>
                      <button onClick={() => setShowUnmappedList(false)}>
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="p-6 max-h-[60vh] overflow-y-auto">
                      <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">
                        Os locais abaixo possuem links que não puderam ser convertidos em coordenadas automáticas. 
                        Verifique se o link está correto ou se é um link que aponta diretamente para o local no mapa.
                        <br/>
                        <span className="text-[10px] font-black text-rose-600 uppercase mt-2 block">Dica: Prefira links diretos com coordenadas (@lat,lng).</span>
                      </p>
                      <div className="space-y-3">
                        {unmappedLocations.map(loc => (
                          <div key={loc.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                            <div className="flex flex-col gap-1">
                              <span className="font-black text-slate-800 text-xs uppercase">{loc.name}</span>
                              <span className="text-[8px] font-mono text-slate-400 truncate max-w-[200px]">{loc.mapsLink}</span>
                            </div>
                            <button 
                              onClick={() => {
                                setIsEditingLoc(loc);
                                setShowUnmappedList(false);
                              }}
                              className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl uppercase hover:bg-blue-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                            >
                              Corrigir
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="p-6 border-t border-slate-50 flex justify-end">
                      <button 
                        onClick={() => setShowUnmappedList(false)}
                        className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors"
                      >
                        Fechar
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {!hasValidMapKey ? (
                <div className="flex items-center justify-center h-full bg-slate-50 p-8 text-center">
                  <div className="max-w-md">
                    <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center shadow-xl mb-8 mx-auto border border-slate-100">
                      <MapIcon className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">API Key Necessária</h2>
                    <p className="text-slate-600 mb-8 font-medium leading-relaxed">Integre o Google Maps Platform para visualizar todos os seus locais monitorados em tempo real no mapa interativo.</p>
                    
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 text-left space-y-6 shadow-2xl shadow-blue-950/5">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">1</div>
                        <p className="text-sm font-bold text-slate-700">Obtenha sua chave no <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noreferrer" className="text-blue-600 underline hover:text-blue-700 transition-colors">Google Cloud Console</a>.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">2</div>
                        <p className="text-sm font-bold text-slate-700">Abra <strong>Configurações</strong> (⚙️) no topo direito.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">3</div>
                        <p className="text-sm font-bold text-slate-700">Em <strong>Secrets</strong>, adicione <code>VITE_GOOGLE_MAPS_PLATFORM_KEY</code> e cole sua chave.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <APIProvider apiKey={MAP_API_KEY} version="weekly">
                  <MapBoundsHandler mappedLocations={mappedLocations} />
                  <GoogleMap
                    defaultCenter={{ lat: -3.89, lng: -38.38 }}
                    defaultZoom={13}
                    mapId="DEMO_MAP_ID"
                    style={{ width: '100%', height: '100%' }}
                    gestureHandling={'greedy'}
                    disableDefaultUI={false}
                  >
                    {mappedLocations.map(({ location, coords }) => (
                      <MarkerWithInfoWindow 
                        key={location.id} 
                        position={coords} 
                        location={location}
                        onSelect={(l) => {
                          setSelectedLocation(l);
                          setCurrentView('cameras');
                        }}
                      />
                    ))}
                  </GoogleMap>
                  
                  {/* Map Overlay Info */}
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10 w-full max-w-2xl px-4">
                    {unmappedLocations.length > 0 && (
                      <button 
                        onClick={() => setShowUnmappedList(true)}
                        className="bg-rose-600/90 backdrop-blur-md text-white px-4 py-2 rounded-xl shadow-lg border border-rose-400/30 flex items-center gap-3 animate-bounce hover:bg-rose-700 transition-colors"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {unmappedLocations.length} LOCAL(IS) COM LINK INVÁLIDO OU NÃO MAPEADO
                        </span>
                      </button>
                    )}
                    
                    <div className="bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl border border-white/50 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm animate-pulse"></div>
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Normal</span>
                      </div>
                      <div className="w-px h-4 bg-slate-300"></div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500 shadow-sm animate-pulse"></div>
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Com Alerta</span>
                      </div>
                      <div className="w-px h-4 bg-slate-300"></div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">
                        {mappedLocations.length} Locais Mapeados
                      </p>
                      {isExpandingLinks && (
                        <div className="flex items-center gap-2 ml-2">
                          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[9px] font-bold text-blue-600 uppercase">Processando links...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </APIProvider>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  </div>

      {/* Repair Modal */}
      <AnimatePresence>
        {repairingCamera && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setRepairingCamera(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="bg-blue-900 p-6 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Relatório de Reparo</h3>
                  <p className="text-blue-200 text-xs mt-0.5">Finalizando manutenção técnica</p>
                </div>
                <div className="bg-white/10 p-2 rounded-full">
                  <Wrench className="w-6 h-6 text-white" />
                </div>
              </div>

              <form onSubmit={handleMaintenanceSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Equipamento</label>
                    <p className="font-bold text-slate-800">Câmera {repairingCamera.camera.number}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Local</label>
                    <p className="font-bold text-slate-800 line-clamp-1">{selectedLocation?.name}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Rede Técnica</label>
                    <p className="font-mono text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">IP: {selectedLocation?.ip} • SERV: {selectedLocation?.server}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Data do Conserto (Editável)</label>
                    <input 
                      type="date" 
                      name="dataConserto"
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Observação / Descrição Técnica *</label>
                    <textarea 
                      name="descricaoTecnica"
                      required
                      rows={3}
                      placeholder="Ex: Troca de conector BNC, limpeza de lente, reinicialização de POE..."
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none font-medium placeholder:text-slate-300"
                    ></textarea>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-50">
                  <button 
                    type="button"
                    onClick={() => setRepairingCamera(null)}
                    className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" /> Concluir Reparo
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Camera Problem Reporting Modal */}
      <AnimatePresence>
        {reportingCamProblem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-rose-600" />
                  </div>
                  <button onClick={() => setReportingCamProblem(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Reportar Falha na Câmera</h3>
                <p className="text-slate-500 text-sm font-medium">
                  Informe o motivo da falha para a <span className="font-bold text-slate-800">Cam {reportingCamProblem.camera.number}</span> em <span className="font-bold text-slate-800">{selectedLocation?.name}</span>.
                </p>
              </div>

              <div className="p-8 pt-4 space-y-4">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const reason = new FormData(e.currentTarget).get('reason') as string;
                    handleReportCameraProblem(reportingCamProblem.locationId, reportingCamProblem.camera.id, reason);
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      'Câmera travada / Sem Imagem',
                      'Problema no Cabo / Conector',
                      'Lente suja / Obstruída',
                      'Avaria Física / Vandalismo',
                      'Interferência no sinal',
                      'Outro Motivo'
                    ].map(motivo => (
                      <button 
                        key={motivo}
                        type="button"
                        onClick={() => handleReportCameraProblem(reportingCamProblem.locationId, reportingCamProblem.camera.id, motivo)}
                        className="w-full text-left p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-rose-500 hover:bg-rose-50 transition-all group"
                      >
                        <span className="text-xs font-black text-slate-700 uppercase tracking-tight group-hover:text-rose-700">{motivo}</span>
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Edit3 className="w-4 h-4 text-slate-400" />
                    </div>
                    <input 
                      name="reason"
                      placeholder="OU DESCREVA O MOTIVO AQUI..."
                      className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 focus:bg-white outline-none transition-all"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setReportingCamProblem(null)}
                      className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all"
                    >
                      Enviar Reporte
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Search Location for General Report Modal */}
      <AnimatePresence>
        {isSelectingLocForReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                  <button onClick={() => setIsSelectingLocForReport(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Selecionar Unidade</h3>
                <p className="text-slate-500 text-sm font-medium">
                  Escolha qual unidade está com <span className="font-bold text-amber-600">problema geral</span>.
                </p>
                
                <div className="relative mt-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="BUSCAR UNIDADE POR NOME OU IP..."
                    onChange={(e) => {
                      const q = e.target.value.toLowerCase();
                      const items = document.querySelectorAll('.loc-selection-item');
                      items.forEach((item: any) => {
                        const name = item.dataset.name.toLowerCase();
                        const ip = item.dataset.ip.toLowerCase();
                        if (name.includes(q) || ip.includes(q)) {
                          item.style.display = 'flex';
                        } else {
                          item.style.display = 'none';
                        }
                      });
                    }}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {[...locations].sort((a, b) => a.name.localeCompare(b.name)).map(loc => (
                  <button 
                    key={loc.id}
                    data-name={loc.name}
                    data-ip={loc.ip}
                    onClick={() => {
                      setReportingLocProblem(loc);
                      setIsSelectingLocForReport(false);
                    }}
                    className="loc-selection-item w-full flex items-center justify-between p-4 rounded-2xl hover:bg-amber-50 group transition-all text-left border border-transparent hover:border-amber-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-amber-600 transition-all border border-slate-100">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm group-hover:text-amber-900 line-clamp-1">{loc.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 group-hover:text-amber-600/70">{loc.ip}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* General Problem Reporting Modal */}
      <AnimatePresence>
        {reportingLocProblem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 pb-4">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                  <button onClick={() => setReportingLocProblem(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Reportar Problema Geral</h3>
                <p className="text-slate-500 text-sm font-medium">
                  Selecione o tipo de problema que afeta <span className="font-bold text-slate-800">{reportingLocProblem.name}</span> por completo. Todas as câmeras deste local serão marcadas com alerta.
                </p>
              </div>

              <div className="p-8 pt-4 space-y-3">
                {[
                  'Sem Energia Elétrica',
                  'NVR Desligado / Travado',
                  'Interrupção de Link / Internet',
                  'Local em Reforma / Obra',
                  'Vandalismo / Furto de Cabeamento',
                  'Outro Problema Geral'
                ].map(problem => (
                  <button 
                    key={problem}
                    onClick={() => handleReportGeneralProblem(reportingLocProblem.id, problem)}
                    className="w-full text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-amber-500 hover:bg-amber-50 transition-all group"
                  >
                    <span className="text-sm font-black text-slate-700 uppercase tracking-tight group-hover:text-amber-700">{problem}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deletion Confirmation Modal */}
      <AnimatePresence>
        {deletingItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="w-10 h-10 text-rose-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirmar Exclusão</h3>
                <p className="text-slate-500 text-sm font-medium px-4">
                  Tem certeza que deseja excluir <span className="font-bold text-slate-800">"{deletingItem.name}"</span>? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-3 p-6 bg-slate-50">
                <button 
                  onClick={() => setDeletingItem(null)}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Secretariat CRUD Modal */}
      <AnimatePresence>
        {(isAddingSec || isEditingSec) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-blue-600 p-8 text-white relative">
                <button 
                  onClick={() => { setIsAddingSec(false); setIsEditingSec(null); }}
                  className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-2xl">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">
                      {isEditingSec ? 'Editar Secretaria' : 'Nova Secretaria'}
                    </h2>
                    <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">Configuração de Colegiado</p>
                  </div>
                </div>
              </div>
              
              <form onSubmit={handleSecSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nome da Secretaria</label>
                    <input 
                      type="text" 
                      name="name"
                      required
                      placeholder="Ex: Saúde, Educação, Segurança..."
                      defaultValue={isEditingSec?.name || ''}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Ícone Temático</label>
                    <select 
                      name="icon"
                      required
                      defaultValue={isEditingSec?.icon || 'Building2'}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                    >
                      <option value="Building2">Padrão (Prédio)</option>
                      <option value="HeartPulse">Saúde</option>
                      <option value="GraduationCap">Educação</option>
                      <option value="Users">Social / Cidadania</option>
                      <option value="ShieldCheck">Segurança</option>
                      <option value="Map">Infraestrutura</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-50">
                  <button 
                    type="button"
                    onClick={() => { setIsAddingSec(false); setIsEditingSec(null); }}
                    className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Location CRUD Modal */}
      <AnimatePresence>
        {(isAddingLoc || isEditingLoc) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-blue-600 p-8 text-white relative">
                <button 
                  onClick={() => { setIsAddingLoc(false); setIsEditingLoc(null); }}
                  className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-2xl">
                    <MapIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">
                      {isEditingLoc ? 'Editar Local' : 'Novo Local'}
                    </h2>
                    <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest">
                      {selectedSecretariat?.name || 'Gestão Técnica'}
                    </p>
                  </div>
                </div>
              </div>
              
              <form onSubmit={handleLocSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nome do Local / Prédio</label>
                    <input 
                      type="text" 
                      name="name"
                      required
                      placeholder="Ex: PSF Gruta da Praia, Escola Modelo..."
                      defaultValue={isEditingLoc?.name || ''}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">IP de Rede (Fim)</label>
                      <input 
                        type="text" 
                        name="ip"
                        required
                        placeholder="Ex: 10.x.x.10..."
                        defaultValue={isEditingLoc?.ip || ''}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Servidor (NVR)</label>
                      <input 
                        type="text" 
                        name="server"
                        required
                        placeholder="Ex: SRV-01..."
                        defaultValue={isEditingLoc?.server || ''}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Categoria / Classificação</label>
                    {selectedSecretariat?.id === 'educacao' || selectedSecretariat?.id === 'saude' ? (
                      <select
                        name="subSecretariat"
                        required
                        defaultValue={isEditingLoc?.subSecretariat || (selectedSecretariat?.id === 'educacao' ? 'ESCOLAS' : 'POSTOS DE SAÚDE')}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                      >
                        {(selectedSecretariat?.id === 'educacao' 
                          ? ['ESCOLAS', 'CRECHES', 'OUTROS LOCAIS'] 
                          : ['POSTOS DE SAÚDE', 'HOSPITAL', 'OUTROS LOCAIS']
                        ).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        name="subSecretariat"
                        placeholder="Ex: Atenção Primária..."
                        defaultValue={isEditingLoc?.subSecretariat || ''}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                      />
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setInputMode('link')}
                        className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${inputMode === 'link' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        Usar Link
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputMode('coords')}
                        className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${inputMode === 'coords' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        Usar Coordenadas
                      </button>
                    </div>

                    {inputMode === 'link' ? (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Link do Google Maps</label>
                        <input 
                          type="url" 
                          name="mapsLink"
                          placeholder="Cole o link do Google Maps aqui..."
                          defaultValue={isEditingLoc?.mapsLink || ''}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Coordenadas (Latitude, Longitude)</label>
                        <input 
                          type="text" 
                          name="coords"
                          placeholder="-3.8966, -38.3842"
                          defaultValue={(() => {
                            const c = extractCoordsFromGoogleMapsLink(isEditingLoc?.mapsLink || '');
                            return c ? `${c.lat}, ${c.lng}` : '';
                          })()}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-50">
                  <button 
                    type="button"
                    onClick={() => { setIsAddingLoc(false); setIsEditingLoc(null); }}
                    className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                  >
                    Confirmar Local
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Footer / Status Bar */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Sistema Operacional</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Servidor Central 10.2.2.170</span>
          </div>
          <div className="hidden sm:block">
            CIVA © 2026 • Vigilância Técnica Aquiraz
          </div>
        </div>
      </footer>
    </div>
  );
}

