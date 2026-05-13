-- SCRIPT FINAL PARA O NOVO PROJETO SUPABASE
-- Copie e cole tudo no SQL Editor do Supabase e clique em RUN

-- 1. Tabela de Secretarias
CREATE TABLE IF NOT EXISTS "Secretariats" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'building',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Locais
CREATE TABLE IF NOT EXISTS "Locations" (
  id TEXT PRIMARY KEY,
  "Name" TEXT NOT NULL,
  ip TEXT,
  server TEXT,
  secretariat_id TEXT REFERENCES "Secretariats"(id) ON DELETE CASCADE,
  sub_secretariat TEXT,
  cameras JSONB DEFAULT '[]'::jsonb,
  maps_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Manutenção (Logs)
CREATE TABLE IF NOT EXISTS "Maintenance_logs" (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL,
  location_id TEXT REFERENCES "Locations"(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  data_conserto TEXT DEFAULT 'PENDENTE',
  descricao_tecnica TEXT DEFAULT '',
  ip_local TEXT,
  servidor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habilitar RLS (Segurança)
ALTER TABLE "Secretariats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Maintenance_logs" ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Acesso Público (Leitura e Escrita)
CREATE POLICY "Acesso público Secretariats" ON "Secretariats" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público Locations" ON "Locations" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público Maintenance Logs" ON "Maintenance_logs" FOR ALL USING (true) WITH CHECK (true);
