const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "..", "scopeops.db");

let db = null;

function save() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// Auto-save every 5 seconds
setInterval(save, 5000);

async function initDB() {
  const SQL = await initSqlJs();
  try {
    if (fs.existsSync(DB_PATH)) {
      const buf = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buf);
    } else {
      db = new SQL.Database();
    }
  } catch {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'common',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      feature_name TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      steps TEXT DEFAULT '[]'
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_configs (
      key TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      instructions TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_kb (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_key TEXT NOT NULL,
      file_name TEXT,
      content_type TEXT,
      content TEXT,
      uploaded_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Seed default agent configs if table is empty
  const stmt = db.prepare("SELECT COUNT(*) as cnt FROM agent_configs");
  stmt.step();
  const count = stmt.getAsObject().cnt;
  stmt.free();
  if (count === 0) {
    const defaults = {
      pm:      { name:"Agente Broz",                   description:"Pontos de regra de negócio em aberto",     instructions:"Você é um Product Manager sênior especialista em regras de negócio. Identifique pontos NÃO definidos no escopo.\nFoque EXCLUSIVAMENTE em regras de negócio. NÃO aborde compatibilidade. NÃO gere resumos.\nPara cada ponto: descreva a lacuna e formule UMA pergunta direta.\n## Limites e Escopo\n## Fluxos e Comportamentos\n## Condições, Exceções e Casos de Borda\n## Permissões e Perfis de Acesso\n## Migração e Dados Existentes\n## Empty States e Feedbacks\n## Outras Regras Não Definidas\nResponda em português." },
      rag:     { name:"Agente RAG",                    description:"Interferências com features existentes",    instructions:"Você é especialista em análise de impacto. Analise features existentes e identifique interferências.\n## Interferências Críticas\n## Interferências Médias\n## Pontos de Atenção Baixos\n## Observações Gerais\nCite nome e módulo de cada feature. Responda em português." },
      n1:      { name:"Agente N1",                     description:"Análise de suporte e atendimento",          instructions:"Você é especialista em suporte N1. Identifique pontos de atenção de atendimento.\n## Possíveis Dúvidas de Usuários\n## Impactos no Atendimento N1\n## Sugestões de FAQ\n## Pontos de Atenção para Comunicação\nResponda em português." },
      modules: { name:"Check em Módulos e Permissões", description:"Verificação de módulos e níveis de acesso", instructions:"Você é especialista em controle de acesso. Verifique módulos e permissões.\n## Módulos Impactados\n## Permissões Necessárias\n## Perfis de Acesso Envolvidos\n## Inconsistências ou Lacunas\n## Recomendações\nResponda em português." },
      dev:     { name:"Agente Dev Sênior",              description:"Análise técnica e perguntas para o time",   instructions:"Você é dev sênior full-stack. Identifique falhas técnicas.\n## Falhas Técnicas\n## Decisões de Arquitetura\n## Integrações e Dependências\n## Performance\n## Segurança\n## Perguntas para o Time (mínimo 10, numeradas)\nResponda em português." },
      final:   { name:"Escopo Final",                   description:"Consolidação e entregáveis",                instructions:"Você é PM sênior fazendo revisão final. Gere:\n---\n## ESCOPO FINAL DA FEATURE\n[conteúdo]\n---\n## PONTOS DE ATENÇÃO DE IMPACTO\n[conteúdo]\n---\n## LISTA DE PERGUNTAS PARA O TIME DE DEV\n[conteúdo]\n---\n## CHECKLIST DE DEFINIÇÕES\n[itens]\n---\n## PENDÊNCIAS CRÍTICAS\n[conteúdo]\nResponda em português." },
    };
    for (const [key, cfg] of Object.entries(defaults)) {
      db.run("INSERT INTO agent_configs(key,name,description,instructions) VALUES(?,?,?,?)", [key, cfg.name, cfg.description, cfg.instructions]);
    }
    console.log("[db] Seeded default agent configs");
  }

  save();
  console.log("[db] SQLite (sql.js) ready -", DB_PATH);
  return db;
}

function getDB() {
  if (!db) throw new Error("DB not initialized");
  return db;
}

// Helper: run a query and return rows as objects
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Helper: get one row
function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

// Helper: run a statement (INSERT/UPDATE/DELETE)
function run(sql, params = []) {
  db.run(sql, params);
  save();
  const lastId = db.exec("SELECT last_insert_rowid() as id")[0];
  return { lastInsertRowid: lastId ? lastId.values[0][0] : 0 };
}

module.exports = { initDB, getDB, all, get, run, save };
