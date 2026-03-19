// GET /api/run/:id — Get full test run detail
// DELETE /api/run/:id — Delete a test run

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function onRequestGet({ params, env }) {
  const id = decodeURIComponent(params.id);
  const run = await env.BSI_DASHBOARD.get(`runs:${id}`, 'json');

  if (!run) {
    return Response.json({ error: 'Run not found' }, { status: 404, headers: CORS_HEADERS });
  }

  return Response.json(run, { headers: CORS_HEADERS });
}

export async function onRequestDelete({ params, env }) {
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

  return Response.json({ ok: true, deleted: id }, { headers: CORS_HEADERS });
}
