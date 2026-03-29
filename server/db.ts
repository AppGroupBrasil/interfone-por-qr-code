import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In production, use /app/data/ (Docker volume) for persistence
// In development, use project root
const dbPath = process.env.NODE_ENV === "production"
  ? path.join("/app", "data", "data.db")
  : path.join(__dirname, "..", "data.db");

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("encoding = 'UTF-8'");
db.pragma("busy_timeout = 5000");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS condominios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    units_count INTEGER DEFAULT 0,
    admin_user_id INTEGER,
    administradora_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    cpf TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'morador',
    perfil TEXT,
    unit TEXT,
    block TEXT,
    condominio_id INTEGER REFERENCES condominios(id),
    parent_administradora_id INTEGER REFERENCES users(id),
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS funcionarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    sobrenome TEXT NOT NULL,
    cargo TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    condominio_id INTEGER REFERENCES condominios(id),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER REFERENCES condominios(id),
    nome TEXT NOT NULL,
    documento TEXT,
    telefone TEXT,
    foto TEXT,
    documento_foto TEXT,
    bloco TEXT,
    apartamento TEXT,
    autorizado_interfone TEXT DEFAULT 'nao',
    quem_autorizou TEXT,
    morador_whatsapp TEXT,
    status TEXT DEFAULT 'pendente',
    token TEXT UNIQUE,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    responded_at TEXT,
    face_descriptor TEXT
  );

  CREATE TABLE IF NOT EXISTS pre_authorizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER REFERENCES condominios(id),
    morador_id INTEGER REFERENCES users(id),
    morador_name TEXT NOT NULL,
    morador_phone TEXT,
    bloco TEXT,
    apartamento TEXT,
    visitante_nome TEXT NOT NULL,
    visitante_documento TEXT,
    visitante_telefone TEXT,
    visitante_foto TEXT,
    tipo TEXT DEFAULT 'simples',
    data_inicio TEXT NOT NULL,
    data_fim TEXT NOT NULL,
    hora_inicio TEXT,
    hora_fim TEXT,
    observacao TEXT,
    status TEXT DEFAULT 'ativa',
    entrada_confirmada_at TEXT,
    entrada_confirmada_por INTEGER REFERENCES users(id),
    token TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Delivery Authorizations table ───
db.exec(`
  CREATE TABLE IF NOT EXISTS delivery_authorizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER REFERENCES condominios(id),
    morador_id INTEGER REFERENCES users(id),
    morador_name TEXT NOT NULL,
    morador_phone TEXT,
    bloco TEXT,
    apartamento TEXT,
    servico TEXT NOT NULL,
    servico_custom TEXT,
    numero_pedido TEXT,
    print_pedido TEXT,
    observacao TEXT,
    status TEXT DEFAULT 'pendente',
    foto_entrega TEXT,
    recebido_por INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    recebido_at TEXT
  );
`);

// ─── Vehicle Authorizations table ───
db.exec(`
  CREATE TABLE IF NOT EXISTS vehicle_authorizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER REFERENCES condominios(id),
    morador_id INTEGER REFERENCES users(id),
    morador_name TEXT NOT NULL,
    morador_phone TEXT,
    bloco TEXT,
    apartamento TEXT,
    placa TEXT NOT NULL,
    modelo TEXT,
    cor TEXT,
    motorista_nome TEXT,
    data_inicio TEXT NOT NULL,
    data_fim TEXT NOT NULL,
    hora_inicio TEXT,
    hora_fim TEXT,
    requer_autorizacao_saida INTEGER DEFAULT 0,
    observacao TEXT,
    status TEXT DEFAULT 'ativa',
    entrada_confirmada_at TEXT,
    entrada_confirmada_por INTEGER REFERENCES users(id),
    saida_solicitada_at TEXT,
    saida_autorizada INTEGER DEFAULT 0,
    saida_autorizada_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Correspondencias (Mail/Package Notifications) table ───
db.exec(`
  CREATE TABLE IF NOT EXISTS correspondencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER REFERENCES condominios(id),
    protocolo TEXT NOT NULL UNIQUE,
    morador_id INTEGER REFERENCES users(id),
    morador_name TEXT NOT NULL,
    bloco TEXT,
    apartamento TEXT,
    tipo TEXT NOT NULL DEFAULT 'encomenda',
    remetente TEXT,
    descricao TEXT,
    foto TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    registrado_por INTEGER REFERENCES users(id),
    retirado_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Livro de Protocolo (Protocol Book) table ───
db.exec(`
  CREATE TABLE IF NOT EXISTS livro_protocolo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER REFERENCES condominios(id),
    protocolo TEXT NOT NULL UNIQUE,
    tipo TEXT NOT NULL DEFAULT 'encomenda',
    deixada_por TEXT,
    para TEXT,
    o_que_e TEXT,
    entregue_para TEXT,
    porteiro_entregou TEXT,
    retirada_por TEXT,
    porteiro TEXT,
    foto TEXT,
    assinatura TEXT,
    titulo TEXT,
    descricao TEXT,
    audio TEXT,
    registrado_por INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: add ocorrencia columns if missing
try {
  db.exec(`ALTER TABLE livro_protocolo ADD COLUMN titulo TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE livro_protocolo ADD COLUMN descricao TEXT`);
} catch {}
try {
  db.exec(`ALTER TABLE livro_protocolo ADD COLUMN audio TEXT`);
} catch {}

// ─── Condominio Config table (per-condominio settings) ───
db.exec(`
  CREATE TABLE IF NOT EXISTS condominio_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(condominio_id, key)
  );
`);

// ─── Ensure global system record (id=0) exists for shared config ───
const globalCond = db.prepare("SELECT id FROM condominios WHERE id = 0").get();
if (!globalCond) {
  db.exec(`INSERT INTO condominios (id, name) VALUES (0, '__SISTEMA_GLOBAL__')`);
}

// ─── Gate Logs table (smart switch activity) ───
db.exec(`
  CREATE TABLE IF NOT EXISTS gate_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    user_id INTEGER REFERENCES users(id),
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Gate Access Points table (multi-access per condo) ───
db.exec(`
  CREATE TABLE IF NOT EXISTS gate_access_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'DoorOpen',
    device_id TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    pulse_duration INTEGER NOT NULL DEFAULT 1000,
    allowed_roles TEXT NOT NULL DEFAULT '["morador","funcionario","sindico"]',
    order_index INTEGER NOT NULL DEFAULT 0,
    is_custom INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Add device_protocol and device_config columns if missing
try {
  db.exec(`ALTER TABLE gate_access_points ADD COLUMN device_protocol TEXT NOT NULL DEFAULT 'ewelink'`);
} catch {}
try {
  db.exec(`ALTER TABLE gate_access_points ADD COLUMN device_config TEXT`);
} catch {}
// Add channel column for multi-channel devices (SONOFF 4CH etc.)
try {
  db.exec(`ALTER TABLE gate_access_points ADD COLUMN channel INTEGER`);
} catch {}
// Allow manual open (button/biometric) — controlled by síndico
try {
  db.exec(`ALTER TABLE gate_access_points ADD COLUMN allow_manual_open INTEGER NOT NULL DEFAULT 1`);
} catch {}
// Botoeira permissions — separate for morador and portaria (staff)
try {
  db.exec(`ALTER TABLE gate_access_points ADD COLUMN allow_botoeira_morador INTEGER NOT NULL DEFAULT 1`);
} catch {}
try {
  db.exec(`ALTER TABLE gate_access_points ADD COLUMN allow_botoeira_portaria INTEGER NOT NULL DEFAULT 1`);
} catch {}


// ─── Cameras table (CCTV monitoring) ───
db.exec(`
  CREATE TABLE IF NOT EXISTS cameras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    nome TEXT NOT NULL,
    setor TEXT NOT NULL DEFAULT 'outros',
    localizacao TEXT,
    url_stream TEXT,
    tipo_stream TEXT NOT NULL DEFAULT 'mjpeg',
    protocolo TEXT NOT NULL DEFAULT 'http',
    ip TEXT,
    porta INTEGER,
    usuario TEXT,
    senha TEXT,
    ativa INTEGER NOT NULL DEFAULT 1,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Ronda Checkpoints (patrol checkpoint locations) ───
db.exec(`
  CREATE TABLE IF NOT EXISTS ronda_checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    localizacao TEXT,
    qr_code_data TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Ronda Schedules (patrol timetables) ───
db.exec(`
  CREATE TABLE IF NOT EXISTS ronda_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    nome TEXT NOT NULL,
    horario TEXT NOT NULL,
    dias_semana TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    som_alerta INTEGER NOT NULL DEFAULT 1,
    ativo INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Ronda Registros (patrol records) ───
db.exec(`
  CREATE TABLE IF NOT EXISTS ronda_registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    checkpoint_id INTEGER NOT NULL REFERENCES ronda_checkpoints(id),
    funcionario_id INTEGER NOT NULL REFERENCES users(id),
    funcionario_nome TEXT NOT NULL,
    checkpoint_nome TEXT NOT NULL,
    localizacao TEXT,
    observacao TEXT,
    foto TEXT,
    latitude REAL,
    longitude REAL,
    ronda_schedule_id INTEGER REFERENCES ronda_schedules(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: add latitude/longitude to condominios
try {
  db.prepare("SELECT latitude FROM condominios LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE condominios ADD COLUMN latitude REAL");
}
try {
  db.prepare("SELECT longitude FROM condominios LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE condominios ADD COLUMN longitude REAL");
}

// Migration: add token column to vehicle_authorizations if missing
try {
  db.prepare("SELECT token FROM vehicle_authorizations LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE vehicle_authorizations ADD COLUMN token TEXT");
}

// Migration: add cadastrado_por_porteiro column to vehicle_authorizations if missing
try {
  db.prepare("SELECT cadastrado_por_porteiro FROM vehicle_authorizations LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE vehicle_authorizations ADD COLUMN cadastrado_por_porteiro INTEGER DEFAULT 0");
}

// Migration: add morador_observacao column for morador response
try {
  db.prepare("SELECT morador_observacao FROM vehicle_authorizations LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE vehicle_authorizations ADD COLUMN morador_observacao TEXT");
}

// Migration: add foto_placa column for plate photo
try {
  db.prepare("SELECT foto_placa FROM vehicle_authorizations LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE vehicle_authorizations ADD COLUMN foto_placa TEXT");
}

// Migration: add face_descriptor column if missing
try {
  db.prepare("SELECT face_descriptor FROM visitors LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE visitors ADD COLUMN face_descriptor TEXT");
}

// Migration: add face_descriptor column to pre_authorizations if missing
try {
  db.prepare("SELECT face_descriptor FROM pre_authorizations LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE pre_authorizations ADD COLUMN face_descriptor TEXT");
}

// Migration: add documento_foto column to pre_authorizations if missing
try {
  db.prepare("SELECT documento_foto FROM pre_authorizations LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE pre_authorizations ADD COLUMN documento_foto TEXT");
}

// Migration: add observacoes column to visitors if missing
try {
  db.prepare("SELECT observacoes FROM visitors LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE visitors ADD COLUMN observacoes TEXT");
}

// Migration: add camera_snapshot columns for auto-capture on access events
for (const table of ["visitors", "delivery_authorizations", "vehicle_authorizations", "correspondencias", "pre_authorizations"]) {
  try {
    db.prepare(`SELECT camera_snapshot FROM ${table} LIMIT 1`).get();
  } catch {
    db.exec(`ALTER TABLE ${table} ADD COLUMN camera_snapshot TEXT`);
  }
  try {
    db.prepare(`SELECT camera_snapshot_at FROM ${table} LIMIT 1`).get();
  } catch {
    db.exec(`ALTER TABLE ${table} ADD COLUMN camera_snapshot_at TEXT`);
  }
  try {
    db.prepare(`SELECT camera_snapshot_nome FROM ${table} LIMIT 1`).get();
  } catch {
    db.exec(`ALTER TABLE ${table} ADD COLUMN camera_snapshot_nome TEXT`);
  }
}

// ─── Interfone Digital tables ───
db.exec(`
  CREATE TABLE IF NOT EXISTS interfone_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    bloco_id INTEGER REFERENCES blocks(id),
    bloco_nome TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    ativo INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interfone_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    nivel_seguranca INTEGER NOT NULL DEFAULT 1,
    nome_validacao TEXT,
    horario_silencioso_inicio TEXT,
    horario_silencioso_fim TEXT,
    bloqueados TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS interfone_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    bloco TEXT NOT NULL,
    apartamento TEXT NOT NULL,
    morador_id INTEGER REFERENCES users(id),
    morador_nome TEXT,
    visitante_nome TEXT,
    visitante_empresa TEXT,
    visitante_foto TEXT,
    nivel_seguranca INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'chamando',
    duracao_segundos INTEGER DEFAULT 0,
    resultado TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    atendido_at TEXT,
    encerrado_at TEXT
  );
`);

// ─── Interfone: add 'call_id' column for WS signaling callId ───
try {
  db.exec(`ALTER TABLE interfone_calls ADD COLUMN call_id TEXT`);
} catch (_) {
  // Column already exists
}

// ─── Interfone: add 'tipo' column for condominium-wide tokens ───
try {
  db.exec(`ALTER TABLE interfone_tokens ADD COLUMN tipo TEXT NOT NULL DEFAULT 'bloco'`);
} catch (_) {
  // Column already exists
}

// Migration: make bloco_id nullable for condominium-wide tokens (bloco_id=0 → NULL)
try {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS interfone_tokens_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        condominio_id INTEGER NOT NULL REFERENCES condominios(id),
        bloco_id INTEGER REFERENCES blocks(id),
        bloco_nome TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        ativo INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        tipo TEXT NOT NULL DEFAULT 'bloco'
      );
      INSERT INTO interfone_tokens_new (id, condominio_id, bloco_id, bloco_nome, token, ativo, created_by, created_at, updated_at, tipo)
        SELECT id, condominio_id, CASE WHEN bloco_id = 0 THEN NULL ELSE bloco_id END, bloco_nome, token, ativo, created_by, created_at, updated_at, tipo
        FROM interfone_tokens;
      DROP TABLE interfone_tokens;
      ALTER TABLE interfone_tokens_new RENAME TO interfone_tokens;
    `);
  })();
} catch (_) {
  // Migration already applied or table doesn't need migration
}

// ─── QR Visitor Share tokens ───
db.exec(`
  CREATE TABLE IF NOT EXISTS visitor_qr_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    qr_data TEXT NOT NULL,
    visitor_name TEXT NOT NULL,
    visitor_doc TEXT,
    visitor_parentesco TEXT,
    data_inicio TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    data_fim TEXT NOT NULL,
    hora_fim TEXT NOT NULL,
    morador_nome TEXT,
    bloco TEXT,
    unidade TEXT,
    condominio_nome TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed default system configs
const existingConfig = db.prepare("SELECT COUNT(*) as count FROM system_config").get() as { count: number };
if (existingConfig.count === 0) {
  db.prepare(`INSERT OR IGNORE INTO system_config (key, value) VALUES
    ('app_name', 'App Interfone'),
    ('maintenance_mode', 'false'),
    ('max_moradores_per_unit', '10'),
    ('allow_self_register', 'true'),
    ('notification_email', ''),
    ('backup_frequency', 'daily')
  `).run();
}

// ─── Database Indexes for Performance ───
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_condominio ON users(condominio_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_blocks_condominio ON blocks(condominio_id);
  CREATE INDEX IF NOT EXISTS idx_funcionarios_condominio ON funcionarios(condominio_id);
  CREATE INDEX IF NOT EXISTS idx_visitors_condominio_status ON visitors(condominio_id, status);
  CREATE INDEX IF NOT EXISTS idx_visitors_token ON visitors(token);
  CREATE INDEX IF NOT EXISTS idx_pre_auth_condominio_status ON pre_authorizations(condominio_id, status);
  CREATE INDEX IF NOT EXISTS idx_pre_auth_token ON pre_authorizations(token);
  CREATE INDEX IF NOT EXISTS idx_delivery_condominio ON delivery_authorizations(condominio_id);
  CREATE INDEX IF NOT EXISTS idx_vehicle_condominio_placa ON vehicle_authorizations(condominio_id, placa);
  CREATE INDEX IF NOT EXISTS idx_vehicle_token ON vehicle_authorizations(token);
  CREATE INDEX IF NOT EXISTS idx_correspondencias_condominio_status ON correspondencias(condominio_id, status);
  CREATE INDEX IF NOT EXISTS idx_correspondencias_morador ON correspondencias(morador_id);
  CREATE INDEX IF NOT EXISTS idx_livro_protocolo_condominio ON livro_protocolo(condominio_id);
  CREATE INDEX IF NOT EXISTS idx_cameras_condominio ON cameras(condominio_id);
  CREATE INDEX IF NOT EXISTS idx_ronda_registros_condominio ON ronda_registros(condominio_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_ronda_checkpoints_condominio ON ronda_checkpoints(condominio_id);
  CREATE INDEX IF NOT EXISTS idx_interfone_tokens_condominio ON interfone_tokens(condominio_id);
  CREATE INDEX IF NOT EXISTS idx_visitor_qr_shares_token ON visitor_qr_shares(token);
  CREATE INDEX IF NOT EXISTS idx_interfone_calls_condominio ON interfone_calls(condominio_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_condominios_cnpj ON condominios(cnpj);
`);

// ─── Device tokens (FCM push notifications) ───
db.exec(`
  CREATE TABLE IF NOT EXISTS device_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'android',
    device_info TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, token)
  );
  CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id, active);
  CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);
`);

// ─── Migration: add is_demo column for demo/sample accounts ───
try {
  db.prepare("SELECT is_demo FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN is_demo INTEGER DEFAULT 0");
  // Mark existing demo accounts
  db.prepare("UPDATE users SET is_demo = 1 WHERE email LIKE '%@demo.app'").run();
}
// Index for is_demo (after migration ensures column exists)
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_is_demo ON users(is_demo) WHERE is_demo = 1`);

// ─── Migration: add aprovado column for self-registration approval ───
try {
  db.prepare("SELECT aprovado FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN aprovado INTEGER DEFAULT 1");
  // Set all existing moradores as approved (only new self-registrations will be pending)
  db.exec("UPDATE users SET aprovado = 1");
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_aprovado ON users(aprovado) WHERE aprovado = 0`);

// ─── Migration: add max_auth_days to condominio_config ALLOWED_KEYS ───
// (Handled in condominioConfig.ts — no schema change needed, uses key/value store)

// ─── Migration: add condominio management columns ───
const condoAdminColumns = [
  { col: "status_pagamento", def: "TEXT DEFAULT 'adimplente'" },
  { col: "bloqueado", def: "INTEGER DEFAULT 0" },
  { col: "bloqueado_at", def: "TEXT" },
  { col: "bloqueado_motivo", def: "TEXT" },
  { col: "last_access_at", def: "TEXT" },
  { col: "access_count", def: "INTEGER DEFAULT 0" },
];
for (const { col, def } of condoAdminColumns) {
  try {
    db.prepare(`SELECT ${col} FROM condominios LIMIT 1`).get();
  } catch {
    db.exec(`ALTER TABLE condominios ADD COLUMN ${col} ${def}`);
  }
}

// ─── Migration: add whatsapp_interfone to interfone_config ───
try {
  db.prepare("SELECT whatsapp_interfone FROM interfone_config LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE interfone_config ADD COLUMN whatsapp_interfone TEXT");
}

// ─── Migration: add parent_administradora_id to users ───
try {
  db.prepare("SELECT parent_administradora_id FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN parent_administradora_id INTEGER REFERENCES users(id)");
}

// ─── Migration: add face_descriptor to users (selfie authentication) ───
try {
  db.prepare("SELECT face_descriptor FROM users LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE users ADD COLUMN face_descriptor TEXT");
}

// ─── Migration: add web_push_keys to device_tokens (Web Push subscriptions) ───
try {
  db.prepare("SELECT web_push_keys FROM device_tokens LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE device_tokens ADD COLUMN web_push_keys TEXT");
}

// ─── Database Backup ───
const backupDir = process.env.NODE_ENV === "production"
  ? path.join("/app", "data", "backups")
  : path.join(__dirname, "..", "backups");

export function performBackup(): string | null {
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupPath = path.join(backupDir, `data-${timestamp}.db`);

    // Use SQLite's backup API via better-sqlite3
    db.backup(backupPath);

    // Keep only the last 7 backups
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith("data-") && f.endsWith(".db"))
      .sort()
      .reverse();

    for (const file of files.slice(7)) {
      fs.unlinkSync(path.join(backupDir, file));
    }

    console.log(`[BACKUP] Backup criado: ${backupPath}`);
    return backupPath;
  } catch (err) {
    console.error("[BACKUP] Erro ao criar backup:", err);
    return null;
  }
}

// ─── Cleanup: auto-delete demo accounts after 30 days ───
export function cleanupDemoAccounts(): number {
  try {
    const result = db.prepare(`
      DELETE FROM users 
      WHERE is_demo = 1 
        AND created_at < datetime('now', '-30 days')
    `).run();
    if (result.changes > 0) {
      console.log(`[CLEANUP] ${result.changes} conta(s) demo removida(s) (30+ dias)`);
    }
    return result.changes;
  } catch (err) {
    console.error("[CLEANUP] Erro ao limpar contas demo:", err);
    return 0;
  }
}

// ─── Cleanup: auto-expire old pre-authorizations & vehicle authorizations ───
export function cleanupExpiredAuthorizations(): number {
  try {
    let total = 0;

    // Pre-authorizations: expire if data_fim passed and still ativa
    const preResult = db.prepare(`
      UPDATE pre_authorizations 
      SET status = 'expirada' 
      WHERE status = 'ativa' 
        AND data_fim < date('now')
    `).run();
    total += preResult.changes;

    // Vehicle authorizations: expire if data_fim passed and still ativa
    const vehicleResult = db.prepare(`
      UPDATE vehicle_authorizations 
      SET status = 'expirada' 
      WHERE status = 'ativa' 
        AND data_fim < date('now')
    `).run();
    total += vehicleResult.changes;

    // Also check condominio-specific max_auth_days limit
    const configs = db.prepare(`
      SELECT condominio_id, value FROM condominio_config 
      WHERE key = 'max_auth_days'
    `).all() as { condominio_id: number; value: string }[];

    for (const cfg of configs) {
      const days = parseInt(cfg.value) || 0;
      if (days <= 0) continue;

      const preMax = db.prepare(`
        UPDATE pre_authorizations 
        SET status = 'expirada' 
        WHERE status = 'ativa' 
          AND condominio_id = ?
          AND created_at < datetime('now', '-' || ? || ' days')
      `).run(cfg.condominio_id, days);
      total += preMax.changes;

      const vehMax = db.prepare(`
        UPDATE vehicle_authorizations 
        SET status = 'expirada' 
        WHERE status = 'ativa' 
          AND condominio_id = ?
          AND created_at < datetime('now', '-' || ? || ' days')
      `).run(cfg.condominio_id, days);
      total += vehMax.changes;
    }

    if (total > 0) {
      console.log(`[CLEANUP] ${total} autorização(ões) expirada(s)`);
    }

    // ── Auto-cancel by time-of-day (vehicle_auto_cancel_time) ──
    const autoCancelConfigs = db.prepare(`
      SELECT condominio_id, value FROM condominio_config
      WHERE key = 'vehicle_auto_cancel_time' AND value != ''
    `).all() as { condominio_id: number; value: string }[];

    const nowLocal = new Date();
    const nowHHMM = nowLocal.toTimeString().slice(0, 5); // "HH:MM"

    for (const cfg of autoCancelConfigs) {
      if (!cfg.value || cfg.value > nowHHMM) continue;
      const todayStr = nowLocal.toISOString().split("T")[0];

      // Fetch affected vehicles before cancelling (for notifications)
      const affectedVehicles = db.prepare(`
        SELECT id, morador_id, placa, bloco, apartamento
        FROM vehicle_authorizations
        WHERE condominio_id = ? AND status = 'ativa' AND data_fim = ?
      `).all(cfg.condominio_id, todayStr) as { id: number; morador_id: number | null; placa: string; bloco: string; apartamento: string }[];

      const autoCancelResult = db.prepare(`
        UPDATE vehicle_authorizations
        SET status = 'utilizada'
        WHERE condominio_id = ?
          AND status = 'ativa'
          AND data_fim = ?
      `).run(cfg.condominio_id, todayStr);
      if (autoCancelResult.changes > 0) {
        console.log(`[CLEANUP] Auto-cancel ${autoCancelResult.changes} ve\u00EDculo(s) cond\u00F4minio ${cfg.condominio_id} (hor\u00E1rio ${cfg.value})`);
        total += autoCancelResult.changes;

        // Notify moradores via Push + Email (lazy import to avoid circular dep)
        Promise.all([
          import("./pushService.js"),
          import("./emailService.js"),
        ]).then(([{ sendPushToUser }, { emailVeiculoEncerrado }]) => {
          for (const v of affectedVehicles) {
            if (!v.morador_id) continue;
            // Push notification
            sendPushToUser(v.morador_id, {
              title: "\u26A0\uFE0F Libera\u00E7\u00E3o de ve\u00EDculo encerrada",
              body: `Sua autoriza\u00E7\u00E3o para o ve\u00EDculo ${v.placa} (${v.bloco} - Apt ${v.apartamento}) foi encerrada automaticamente. Refa\u00E7a pelo app se precisar.`,
              data: { type: "vehicle_cancelled", vehicleId: String(v.id) },
            }).catch(() => {});
            // Email
            emailVeiculoEncerrado({
              condominioId: cfg.condominio_id,
              moradorId: v.morador_id,
              bloco: v.bloco,
              apartamento: v.apartamento,
              placa: v.placa,
              motivo: "encerrada automaticamente (hor\u00E1rio limite)",
            }).catch((err: any) => console.error("[EMAIL] Erro ve\u00EDculo encerrado:", err));
          }
        }).catch((err) => console.error("[CLEANUP] Erro ao notificar moradores:", err));
      }
    }

    return total;
  } catch (err) {
    console.error("[CLEANUP] Erro ao expirar autorizações:", err);
    return 0;
  }
}

// ─── Cleanup: old audit logs (keep 90 days) ───
export function cleanupOldAuditLogs(): number {
  try {
    const result = db.prepare(`
      DELETE FROM audit_logs 
      WHERE created_at < datetime('now', '-90 days')
    `).run();
    if (result.changes > 0) {
      console.log(`[CLEANUP] ${result.changes} log(s) de auditoria removido(s) (90+ dias)`);
    }
    return result.changes;
  } catch (err) {
    console.error("[CLEANUP] Erro ao limpar logs:", err);
    return 0;
  }
}

// ─── WhatsApp Log table ───
db.exec(`
  CREATE TABLE IF NOT EXISTS whatsapp_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    condominio_id INTEGER NOT NULL REFERENCES condominios(id),
    phone TEXT NOT NULL,
    template_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    message_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_whatsapp_log_condominio ON whatsapp_log(condominio_id, created_at);
`);

export default db;

// Helper types
export interface DbCondominio {
  id: number;
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  units_count: number;
  admin_user_id: number | null;
  administradora_id: number | null;
  latitude: number | null;
  longitude: number | null;
  status_pagamento: string;
  bloqueado: number;
  bloqueado_at: string | null;
  bloqueado_motivo: string | null;
  last_access_at: string | null;
  access_count: number;
  created_at: string;
  updated_at: string;
}

export interface DbUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  password: string;
  role: string;
  perfil: string | null;
  unit: string | null;
  block: string | null;
  condominio_id: number | null;
  parent_administradora_id: number | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
