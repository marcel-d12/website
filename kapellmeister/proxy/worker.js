// Cloudflare Worker: leitet Anfragen von Kapellmeister an die Anthropic-API weiter.
// Der API-Schlüssel liegt nur hier (Secret ANTHROPIC_API_KEY), nie im Browser.
// Secrets/Variablen im Cloudflare-Dashboard:
//   ANTHROPIC_API_KEY  (Secret)  sk-ant-…
//   DEMO_CODE          (Secret)  ein oder mehrere Zugangscodes, durch Komma getrennt
//   ALLOWED_ORIGINS    (optional) z. B. "https://marcelhorstmann.com,https://www.marcelhorstmann.com"
//   DAILY_LIMIT        (optional) Anfragen pro Tag und Code, Standard 150
//   PING_URL           (Secret, optional) Benachrichtigung bei Nutzung: Discord-Webhook-URL oder https://ntfy.sh/<thema>
//   PING_IGNORE        (optional) Codes ohne Benachrichtigung, z. B. der eigene Test-Code

const DEFAULT_ORIGINS = [
  "https://marcelhorstmann.com",
  "https://www.marcelhorstmann.com",
  "https://marcelhorstmann.de",
  "https://www.marcelhorstmann.de",
  "https://marcel-d12.github.io",
];
const ALLOWED_MODELS = ["claude-opus-5-5"];
const MAX_TOKENS = 32000;
const ALLOWED_BETAS = ["server-side-fallback-2026-07-01", "fast-mode-2026-02-01"];
const ALLOWED_FIELDS = ["model", "max_tokens", "system", "messages", "thinking", "output_config", "stream", "fallbacks", "metadata", "speed"];

// einfacher Zähler pro Worker-Instanz (kein harter Schutz; das eigentliche Limit ist das Ausgabenlimit in der Anthropic-Konsole)
const counters = new Map();

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()) : DEFAULT_ORIGINS);
    const originOk = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const cors = {
      "Access-Control-Allow-Origin": originOk ? origin : allowed[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "content-type, x-demo-code",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const reply = (status, message) => new Response(JSON.stringify({ type: "error", error: { type: status === 403 ? "permission_error" : status === 429 ? "rate_limit_error" : "invalid_request_error", message } }), { status, headers: { ...cors, "content-type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (!originOk) return reply(403, "Origin nicht erlaubt");
    const url = new URL(request.url);
    const isVisit = /\/visit$/.test(url.pathname);
    if (request.method !== "POST" || (!isVisit && !/\/v1\/messages$/.test(url.pathname))) return reply(404, "Nur POST /v1/messages");

    // Demo-Code prüfen
    const codes = (env.DEMO_CODE || "").split(",").map((s) => s.trim()).filter(Boolean);
    const code = request.headers.get("x-demo-code") || "";
    if (!codes.length || !codes.some((c) => safeEqual(c, code))) return reply(403, "Demo-Code ungültig");

    // Seite mit Demo-Zugang geöffnet: nur benachrichtigen
    if (isVisit) {
      notify(env, ctx, code, "visit", "Seite mit Demo-Zugang geöffnet");
      return new Response(null, { status: 204, headers: cors });
    }

    // Tageslimit pro Code
    const day = new Date().toISOString().slice(0, 10);
    const key = `${day}:${code}`;
    const limit = parseInt(env.DAILY_LIMIT || "150", 10);
    const n = (counters.get(key) || 0) + 1;
    counters.set(key, n);
    if (n > limit) return reply(429, "Tageslimit für diesen Demo-Code erreicht");

    // Anfrage prüfen und auf erlaubte Felder beschränken
    let body;
    try { body = await request.json(); } catch (e) { return reply(400, "Ungültiges JSON"); }
    if (!ALLOWED_MODELS.includes(body.model)) return reply(400, "Modell nicht erlaubt");
    const clean = {};
    for (const f of ALLOWED_FIELDS) if (body[f] !== undefined) clean[f] = body[f];
    clean.max_tokens = Math.min(parseInt(clean.max_tokens, 10) || 4096, MAX_TOKENS);
    if (clean.speed !== undefined && clean.speed !== "fast" && clean.speed !== "standard") delete clean.speed;
    if (JSON.stringify(clean).length > 400000) return reply(400, "Anfrage zu groß");
    notify(env, ctx, code, "use", describe(clean));

    const betas = (request.headers.get("anthropic-beta") || "").split(",").map((s) => s.trim()).filter((b) => ALLOWED_BETAS.includes(b));
    const upstream = (env.UPSTREAM || "https://api.anthropic.com").replace(/\/+$/, "");
    const res = await fetch(`${upstream}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": request.headers.get("anthropic-version") || "2023-06-01",
        ...(betas.length ? { "anthropic-beta": betas.join(",") } : {}),
      },
      body: JSON.stringify(clean),
    });
    // Antwort (auch Streaming) unverändert durchreichen
    const headers = new Headers(cors);
    for (const h of ["content-type", "request-id", "retry-after"]) { const v = res.headers.get(h); if (v) headers.set(h, v); }
    headers.set("Access-Control-Expose-Headers", "request-id, retry-after");
    return new Response(res.body, { status: res.status, headers });
  },
};

// Benachrichtigung an Discord (Webhook) oder ntfy. Gedrosselt pro Code: Besuch höchstens alle 6 Stunden,
// Nutzung höchstens alle 15 Minuten (pro Worker-Instanz, daher gelegentlich doppelt).
const lastPing = new Map();
function notify(env, ctx, code, kind, text) {
  const target = env.PING_URL;
  if (!target) return;
  const ignore = (env.PING_IGNORE || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ignore.includes(code)) return;
  const key = `${kind}:${code}`;
  const now = Date.now();
  const gap = kind === "visit" ? 6 * 3600 * 1000 : 15 * 60 * 1000;
  if (now - (lastPing.get(key) || 0) < gap) return;
  lastPing.set(key, now);
  const message = `Kapellmeister: ${text} (Code ${code})`;
  const send = /discord(app)?\.com\/api\/webhooks/.test(target)
    ? fetch(target, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: `🎼 ${message}` }) })
    : fetch(target, { method: "POST", headers: { Title: "Kapellmeister", Tags: "musical_note" }, body: message });
  const done = send.catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(done);
}

// Kurz beschreiben, was gerade gemacht wird (ohne Inhalte der Partitur)
function describe(body) {
  const first = Array.isArray(body.messages) && body.messages[0] ? body.messages[0].content : "";
  const u = typeof first === "string" ? first : "";
  if (u.startsWith("Aufgabe: Komponiere")) {
    const stil = (u.match(/^Stil: ([^(\n]+?)\s*\(/m) || [])[1];
    const form = (u.match(/^Gattung\/Form: (.+?)\.?$/m) || [])[1];
    return `komponiert ${form || "ein Stück"}${stil ? ` im Stil von ${stil}` : ""}`;
  }
  if (u.startsWith("Aufgabe: Überarbeite")) return u.includes("Markierte Stellen") || u.includes("Allgemeiner Wunsch") ? "überarbeitet eine Partitur" : "lässt Fehler korrigieren";
  if (u.startsWith("Aufgabe: Begutachte")) return "holt Verbesserungsvorschläge";
  if (u.startsWith("Aufgabe: Setze das Stück")) return "lässt Fortsetzungen schreiben";
  if (u.startsWith("Frage zur Partitur")) return "stellt eine Frage zur Partitur";
  return "nutzt Claude";
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
