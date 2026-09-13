import { env } from 'cloudflare:workers';
import { createGameSnapshotsTable } from '@/db/schema';

const cookieName = 'storyteller_device';

function getClient(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
  return match ? { id:decodeURIComponent(match[1]), isNew:false } : { id:crypto.randomUUID(), isNew:true };
}

function responseHeaders(client: { id:string; isNew:boolean }, request: Request) {
  const headers = new Headers({ 'Content-Type':'application/json' });
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  if (client.isNew) headers.append('Set-Cookie',`${cookieName}=${encodeURIComponent(client.id)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}; HttpOnly`);
  return headers;
}

async function ensureSchema() {
  await env.DB.prepare(createGameSnapshotsTable).run();
}

export async function GET(request: Request) {
  await ensureSchema();
  const client = getClient(request);
  const row = await env.DB.prepare('SELECT state_json FROM game_snapshots WHERE client_id = ?').bind(client.id).first<{state_json:string}>();
  let state: unknown = null;
  try { state = row?.state_json ? JSON.parse(row.state_json) : null; } catch { state = null; }
  return new Response(JSON.stringify({ state }),{ headers:responseHeaders(client,request) });
}

export async function PUT(request: Request) {
  await ensureSchema();
  const client = getClient(request);
  const body = await request.json() as { state?:unknown };
  if (!body.state || typeof body.state !== 'object') {
    return Response.json({ error:'无效的对局记录' }, { status:400 });
  }
  const stateJson = JSON.stringify(body.state);
  if (stateJson.length > 500_000) return Response.json({ error:'对局记录过大' }, { status:413 });
  await env.DB.prepare(`INSERT INTO game_snapshots (client_id, state_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(client_id) DO UPDATE SET state_json=excluded.state_json, updated_at=excluded.updated_at`)
    .bind(client.id,stateJson,Date.now()).run();
  return new Response(JSON.stringify({ ok:true }),{ headers:responseHeaders(client,request) });
}
