import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Trash2, 
  Terminal, 
  User, 
  Clock, 
  Database, 
  Copy, 
  Check, 
  Info, 
  ShieldCheck, 
  Printer, 
  Filter,
  ArrowUpDown,
  Laptop
} from 'lucide-react';

interface ActivityLog {
  id: string;
  username: string;
  role: string;
  action: string;
  details: string;
  timestamp: string;
  ip_address?: string;
}

interface SystemActivityLogsProps {
  logs: ActivityLog[];
  onClearLogs: () => void;
  supabaseConnected: boolean;
}

const SystemActivityLogs: React.FC<SystemActivityLogsProps> = ({ 
  logs, 
  onClearLogs,
  supabaseConnected
}) => {
  const [search, setSearch] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Copy SQL script tool
  const sqlScript = `-- 1. Criar Tabela de Logs de Atividades do Sistema se não existir
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar segurança em nível de linha (RLS)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 3. Criar política de leitura/escrita pública com segurança contra duplicidade
DROP POLICY IF EXISTS "Acesso público activity_logs" ON public.activity_logs;
CREATE POLICY "Acesso público activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- 4. Adicionar Tabelas ao Realtime de forma segura (impede erros se a tabela já fizer parte da publicação)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.secretariats;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_logs;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;
END $$;`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // Humanize action tags for colors
  const getActionStyles = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('login') || act.includes('auth')) {
      return { bg: 'bg-indigo-50 border-indigo-100 text-indigo-700', label: 'AUTENTICAÇÃO' };
    }
    if (act.includes('excluiu') || act.includes('deletar')) {
      return { bg: 'bg-rose-50 border-rose-100 text-rose-700', label: 'EXCLUSÃO' };
    }
    if (act.includes('adicionou') || act.includes('criou') || act.includes('cadastrou')) {
      return { bg: 'bg-emerald-50 border-emerald-100 text-emerald-700', label: 'CRIAÇÃO' };
    }
    if (act.includes('resolveu') || act.includes('conserto') || act.includes('reparar')) {
      return { bg: 'bg-sky-50 border-sky-100 text-sky-700', label: 'MANUTENÇÃO/REPARO' };
    }
    if (act.includes('reportou') || act.includes('falha') || act.includes('problema')) {
      return { bg: 'bg-amber-50 border-amber-100 text-amber-700', label: 'ALERTA/FALHA' };
    }
    return { bg: 'bg-slate-50 border-slate-100 text-slate-700', label: 'SISTEMA' };
  };

  const filteredLogs = useMemo(() => {
    let result = [...logs];

    // Filter by action type
    if (selectedActionType !== 'all') {
      result = result.filter(log => {
        const type = getActionStyles(log.action).label.toLowerCase();
        return type.includes(selectedActionType.toLowerCase());
      });
    }

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(log => 
        log.username.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [logs, search, selectedActionType, sortOrder]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Terminal className="w-6 h-6 text-indigo-600" />
            LOGS DE ATIVIDADES DO SISTEMA
          </h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
            Auditoria completa em tempo real das ações desempenhadas por usuários no CIVA
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto no-print">
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all shadow-sm flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
            title="Inverter ordem temporal"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortOrder === 'desc' ? 'Mais recentes' : 'Mais antigos'}
          </button>

          <button
            onClick={handlePrint}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all shadow-sm flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <Printer className="w-4 h-4" />
            Imprimir Logs
          </button>

          <button
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="p-2.5 bg-rose-50 border border-rose-100 hover:bg-rose-600 hover:text-white hover:border-rose-600 text-rose-600 rounded-xl transition-all shadow-sm flex items-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50 disabled:pointer-events-none"
          >
            <Trash2 className="w-4 h-4" />
            Limpar Histórico
          </button>
        </div>
      </div>

      {/* Supabase Shared Sync Status info block */}
      <div className="no-print">
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-10">
            <Database className="w-56 h-56" />
          </div>
          <div className="relative flex flex-col md:flex-row gap-4 items-start md:items-center justify-between z-10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Database className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm tracking-tight text-white uppercase">Sincronização Compartilhada Cloud</h3>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm ${
                    supabaseConnected 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-amber-600 text-white'
                  }`}>
                    {supabaseConnected ? 'CONECTADO AO SUPABASE' : 'PERSISTÊNCIA LOCAL'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed font-medium">
                  Atualmente, os logs de auditoria estão ativos e salvando localmente neste navegador. Para que todos os computadores da sua central vejam exatamente as mesmas entradas de logs em tempo real na nuvem do Supabase, você só precisa habilitar a tabela correspondente.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowSqlGuide(!showSqlGuide)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-indigo-50 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-indigo-900/40 active:scale-[0.98] cursor-pointer"
            >
              {showSqlGuide ? 'Ocultar Guia SQL' : 'Ver Guia SQL'}
            </button>
          </div>

          {showSqlGuide && (
            <div className="mt-5 border-t border-slate-800 pt-4 space-y-4 animate-fadeIn">
              <p className="text-xs text-indigo-200 leading-normal flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
                <span>
                  No painel de controle do seu Supabase, vá em <strong>SQL Editor</strong>, crie uma <strong>New Query</strong>, cole o código abaixo e execute-o clicando em <strong>RUN (Ctrl+Enter)</strong>.
                </span>
              </p>
              
              <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 text-[11px] font-mono p-4 text-emerald-400 select-all overflow-x-auto max-h-56 no-print">
                <button
                  onClick={copySqlToClipboard}
                  className="absolute right-3 top-3 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                  title="Copiar Código SQL"
                >
                  {copiedSql ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <pre>{sqlScript}</pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center no-print">
        <div className="relative w-full md:max-w-md group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input
            type="text"
            placeholder="Filtrar por usuário, ação, detalhes, IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 rounded-2xl text-xs transition-all font-semibold text-slate-800 uppercase tracking-wide placeholder:capitalize"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto no-scrollbar py-0.5 select-none">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-indigo-500" />
            Filtrar:
          </span>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'autenticação', label: 'Entradas/Saídas' },
            { id: 'criação', label: 'Cadastros' },
            { id: 'exclusão', label: 'Exclusões' },
            { id: 'manutenção/reparo', label: 'Manutenções' },
            { id: 'alerta/falha', label: 'Alertas/Falhas' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedActionType(tab.id)}
              className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap active:scale-95 ${
                selectedActionType === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.03]'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table Area */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4.5 text-[9px] font-black uppercase tracking-wider text-slate-500 w-48">Tempo / Hora</th>
                <th className="px-6 py-4.5 text-[9px] font-black uppercase tracking-wider text-slate-500 w-44">Usuário</th>
                <th className="px-6 py-4.5 text-[9px] font-black uppercase tracking-wider text-slate-500 w-48">Ação Realizada</th>
                <th className="px-6 py-4.5 text-[9px] font-black uppercase tracking-wider text-slate-500">Detalhes / Evento</th>
                <th className="px-6 py-4.5 text-[9px] font-black uppercase tracking-wider text-slate-500 w-36 text-center">Origem IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.map(log => {
                  const tagInfo = getActionStyles(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Timestamp */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[11px] font-semibold font-mono leading-none">
                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </td>

                      {/* User Profile */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                            log.role === 'admin' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {log.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-[11px] font-extrabold text-slate-800 uppercase block tracking-wide">
                              {log.username}
                            </span>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.2 rounded-md ${
                              log.role === 'admin'
                                ? 'bg-blue-50 text-blue-600'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {log.role === 'admin' ? 'ADMIN' : 'VISUALIZADOR'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action Code with custom Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 border rounded-lg shadow-sm ${tagInfo.bg}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Action Details */}
                      <td className="px-6 py-4">
                        <p className="text-[11px] font-semibold text-slate-700 leading-relaxed uppercase tracking-wide">
                          {log.details}
                        </p>
                      </td>

                      {/* IP Source */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5 text-slate-500">
                          <Laptop className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[10px] font-semibold font-mono">
                            {log.ip_address || 'Local/Client'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="max-w-xs mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mb-3 border border-slate-100">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Nenhum log encontrado para esse filtro.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table footer info */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Total de Atividades Registradas: {filteredLogs.length}</span>
          <span>CIVA Security Operations • {new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </div>
  );
};

export default SystemActivityLogs;
