const origins = new Set([
  'https://rachelwilliam.com',
  'https://www.rachelwilliam.com',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
]);
const responses = new Set(["I can't :(", "Yes! I'm in", 'I need more time']);

export default async function handler(request) {
  const origin = request.headers.get('origin');
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
  if (!origins.has(origin)) return reply(403, { success: false });
  headers['Access-Control-Allow-Origin'] = origin;
  headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { success: false });

  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply(413, { success: false });
    const fields = new URLSearchParams(raw);
    const name = (fields.get('name') || '').trim();
    const response = fields.get('response') || '';
    if (fields.get('_honey') || !name || name.length > 200 || !responses.has(response)) {
      return reply(400, { success: false });
    }
    const submissionId = crypto.randomUUID();
    const body = new URLSearchParams({
      'form-name': 'wedding-response', name, response, _honey: '', 'submission-id': submissionId,
    });
    // Netlify processes this registered form before serving the success page.
    const result = await fetch(new URL('/received.html', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
    });
    const receipt = await result.text();
    if (result.status !== 200 || !receipt.includes('<meta name="rsvp-receipt" content="accepted">')) {
      return reply(502, { success: false });
    }
    return reply(200, { success: true, submissionId });
  } catch {
    return reply(503, { success: false });
  }
}
