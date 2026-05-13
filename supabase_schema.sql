-- Script SQL para criar as tabelas no Supabase (Rodar no SQL Editor)

-- 1. Tabela de Secretarias
CREATE TABLE IF NOT EXISTS secretariats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'building',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Locais
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ip TEXT,
  server TEXT,
  secretariat_id TEXT REFERENCES secretariats(id) ON DELETE CASCADE,
  sub_secretariat TEXT,
  cameras JSONB DEFAULT '[]'::jsonb,
  maps_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Manutenção (Logs)
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL,
  location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  data_conserto TEXT DEFAULT 'PENDENTE',
  descricao_tecnica TEXT DEFAULT '',
  ip_local TEXT,
  servidor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habilitar RLS (Row Level Security) - Desabilitado por padrão para facilitar o teste inicial
-- Se quiser segurança total, habilite e crie as políticas:
ALTER TABLE secretariats ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de acesso para todos (Leitura e Escrita)
CREATE POLICY "Acesso público Secretariats" ON secretariats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público Locations" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público Maintenance Logs" ON maintenance_logs FOR ALL USING (true) WITH CHECK (true);
