// GET /api/events — List webhook events from bsi-devops

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
  const events = await env.BSI_DASHBOARD.get('events:log', 'json');
  return Response.json(events || [], { headers: getCorsHeaders(request) });
}
