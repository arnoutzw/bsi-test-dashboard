// GET /api/run/:id — Get full test run detail
// DELETE /api/run/:id — Delete a test run

const ALLOWED_ORIGINS = ['https://blacksphereindustries.nl', 'https://www.blacksphereindustries.nl'];
function getCorsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.pages.dev');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { headers: getCorsHeaders(request) });
}

export async function onRequestGet({ request, params, env }) {
  const cors = getCorsHeaders(request);
  const id = decodeURIComponent(params.id);
  const run = await env.BSI_DASHBOARD.get(`runs:${id}`, 'json');

  if (!run) {
    return Response.json({ error: 'Run not found' }, { status: 404, headers: cors });
  }

  return Response.json(run, { headers: cors });
}

export async function onRequestDelete({ request, params, env }) {
  const cors = getCorsHeaders(request);
  const id = decodeURIComponent(params.id);

  // Delete the run data
  await env.BSI_DASHBOARD.delete(`runs:${id}`);

  // Remove from index
  const index = await env.BSI_DASHBOARD.get('runs:index', 'json');
  if (index && index.runs) {
    index.runs = index.runs.filter(r => r.id !== id);
    index.lastUpdated = new Date().toISOString();
    await env.BSI_DASHBOARD.put('runs:index', JSON.stringify(index));
  }

  return Response.json({ ok: true, deleted: id }, { headers: cors });
}
