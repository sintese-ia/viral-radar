import { Pool, types } from "pg";

// bigint (int8) e numeric chegam como string por padrão — nossa escala (views,
// followers) cabe com folga em Number, então parseamos como float.
types.setTypeParser(20, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

// Postgres do Easypanel (cells-postgres), schema `viral_radar`.
// Local: easypanel.sinteseia.com.br:5432 · deployado: cells-postgres:5432 (rede interna).
let pool: Pool | null = null;

export function db(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurado no .env.local");
    pool = new Pool({ connectionString: url, max: 5 });
    pool.on("connect", (client) => {
      client.query("set search_path to viral_radar, public");
    });
  }
  return pool;
}

export async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await db().query(text, params);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/** true se o erro do pg é violação de unique */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}
