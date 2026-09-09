import { env } from 'cloudflare:workers';
import { createGameLogsOrderIndex, createGameLogsTable, createGameStateTable } from '@/db/schema';

type StoredLog = { id:string; dayNumber:number; phase:string; kind:string; title:string; detail?:string; createdAt:number };

async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare(createGameStateTable),
    env.DB.prepare(createGameLogsTable),
    env.DB.prepare(createGameLogsOrderIndex),
  ]);
}

export async function GET() {
  await ensureSchema();
  const state = await env.DB.prepare('SELECT script_id, day_number, phase, game_started FROM game_state WHERE id = 1').first();
  const logs = await env.DB.prepare('SELECT id, day_number, phase, kind, title, detail, created_at FROM game_logs ORDER BY created_at ASC').all();
  return Response.json({
    state: state ? { scriptId:state.script_id, dayNumber:state.day_number, phase:state.phase, gameStarted:Boolean(state.game_started) } : null,
    logs: logs.results.map((row) => ({ id:row.id, dayNumber:row.day_number, phase:row.phase, kind:row.kind, title:row.title, detail:row.detail ?? undefined, createdAt:row.created_at })),
  });
}

export async function PUT(request: Request) {
  await ensureSchema();
  const body = await request.json() as { scriptId?:string; dayNumber?:number; phase?:string; gameStarted?:boolean; logs?:StoredLog[] };
  if (!body.scriptId || !Number.isInteger(body.dayNumber) || !['firstNight','day','night'].includes(body.phase ?? '') || !Array.isArray(body.logs)) {
    return Response.json({ error:'无效的对局记录' }, { status:400 });
  }
  const statements = [
    env.DB.prepare(`INSERT INTO game_state (id, script_id, day_number, phase, game_started, updated_at) VALUES (1, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET script_id=excluded.script_id, day_number=excluded.day_number, phase=excluded.phase, game_started=excluded.game_started, updated_at=excluded.updated_at`)
      .bind(body.scriptId, body.dayNumber, body.phase, body.gameStarted ? 1 : 0, Date.now()),
    env.DB.prepare('DELETE FROM game_logs'),
    ...body.logs.slice(-500).map((entry) => env.DB.prepare('INSERT INTO game_logs (id, day_number, phase, kind, title, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(entry.id, entry.dayNumber, entry.phase, entry.kind, entry.title, entry.detail ?? null, entry.createdAt)),
  ];
  await env.DB.batch(statements);
  return Response.json({ ok:true });
}
