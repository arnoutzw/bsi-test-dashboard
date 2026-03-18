// GET /api/run/:id — Get full test run detail

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
