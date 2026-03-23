// GET /api/manifests — List manifest versions
// GET /api/manifests?version=1.2.9 — Get specific manifest

const ALLOWED_ORIGINS = ['https://blacksphereindustries.nl', 'https://www.blacksphereindustries.nl'];
function getCorsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.pages.dev');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { headers: getCorsHeaders(request) });
}

export async function onRequestGet({ request, env }) {
  const cors = getCorsHeaders(request);
  const url = new URL(request.url);
  const version = url.searchParams.get('version');

  if (version) {
    const manifest = await env.BSI_DASHBOARD.get(`manifests:${version}`, 'json');
    if (!manifest) {
      return Response.json({ error: 'Manifest not found' }, { status: 404, headers: cors });
    }
    return Response.json(manifest, { headers: cors });
  }

  const index = await env.BSI_DASHBOARD.get('manifests:index', 'json');
  return Response.json(index || { versions: [] }, { headers: cors });
}
