-- SCRIPT FINAL PARA O NOVO PROJETO SUPABASE (REAL-TIME INTEGRADO)
-- Copie e cole tudo no SQL Editor do Supabase e clique em RUN

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

-- 4. Tabela de Usuários (Gestão de Acesso)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- Em um sistema real, use Supabase Auth. Aqui mantemos conforme pedido.
  role TEXT DEFAULT 'viewer', -- 'admin' ou 'viewer'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Habilitar RLS (Segurança)
ALTER TABLE secretariats ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de Acesso Público (Leitura e Escrita)
CREATE POLICY "Acesso público secretariats" ON secretariats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público locations" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público maintenance_logs" ON maintenance_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público users" ON users FOR ALL USING (true) WITH CHECK (true);

-- 7. Habilitar Realtime para as tabelas principais
ALTER PUBLICATION supabase_realtime ADD TABLE secretariats;
ALTER PUBLICATION supabase_realtime ADD TABLE locations;
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- 8. Inserir usuário administrador inicial
INSERT INTO users (username, password, role) 
VALUES ('renato', '32604509', 'admin')
ON CONFLICT (username) DO NOTHING;
