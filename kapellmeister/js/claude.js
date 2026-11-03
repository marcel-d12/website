// Anbindung an Claude über das offizielle Anthropic-SDK.
// Zwei Wege: über den Proxy (API-Schlüssel liegt dort, Zugang per Demo-Code) oder mit eigenem Schlüssel.
import Anthropic from "../vendor/anthropic-sdk.min.js";
import { CONFIG } from "./config.js";
import { SYSTEM_PROMPT } from "./prompts.js";

const store = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
  set(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* privat */ } },
};

export class EngineError extends Error {
  constructor(message, kind) { super(message); this.kind = kind; }
}

export const access = {
  get proxyUrl() { return store.get("km-proxy") || CONFIG.proxyUrl; },
  set proxyUrl(v) { store.set("km-proxy", v); },
  get code() { return store.get("km-code"); },
  set code(v) { store.set("km-code", v); },
  get apiKey() { return store.get("km-apikey"); },
  set apiKey(v) { store.set("km-apikey", v); },
  mode() {
    if (this.apiKey) return "key";
    if (this.proxyUrl && this.code) return "proxy";
    return null;
  },
  describe() {
    const m = this.mode();
    if (m === "key") return "eigener API-Schlüssel";
    if (m === "proxy") return "Demo-Zugang";
    return null;
  },
};

// Zugangsdaten aus dem Link übernehmen: …/kapellmeister/#code=XYZ (optional &proxy=https://…)
export function readAccessFromHash() {
  const h = location.hash.replace(/^#/, "");
  if (!h) return false;
  const params = new URLSearchParams(h);
  let changed = false;
  if (params.get("code")) { access.code = params.get("code"); changed = true; }
  if (params.get("proxy")) { access.proxyUrl = params.get("proxy"); changed = true; }
  if (changed) history.replaceState(null, "", location.pathname + location.search);
  return changed;
}

function client() {
  const mode = access.mode();
  if (mode === "key") {
    return new Anthropic({ apiKey: access.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 10 * 60 * 1000 });
  }
  if (mode === "proxy") {
    return new Anthropic({
      apiKey: "proxy", // der Proxy ersetzt das durch den echten Schlüssel
      baseURL: access.proxyUrl.replace(/\/+$/, ""),
      dangerouslyAllowBrowser: true,
      defaultHeaders: { "x-demo-code": access.code },
      maxRetries: 2,
      timeout: 10 * 60 * 1000,
    });
  }
  throw new EngineError("Kein Zugang zu Claude eingerichtet.", "setup");
}

// Eine Anfrage an Claude mit Streaming. Liefert den Antworttext (bei Fallback nur den Teil des Modells, das geantwortet hat).
export async function ask({ user, effort = "medium", maxTokens = CONFIG.maxTokens, schema = null, onText, onThinking, signal }) {
  const c = client();
  const outputConfig = { effort };
  if (schema) outputConfig.format = { type: "json_schema", schema };
  const params = {
    model: CONFIG.model,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive", display: "summarized" },
    output_config: outputConfig,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  };
  let text = "";
  let thinking = "";
  try {
    const stream = c.beta.messages.stream(params, { signal });
    stream.on("streamEvent", (ev) => {
      if (ev.type === "content_block_start" && ev.content_block && ev.content_block.type === "fallback") {
        // anderes Modell übernimmt: bisherigen Text verwerfen
        text = "";
      }
      if (ev.type === "content_block_delta") {
        if (ev.delta.type === "text_delta") { text += ev.delta.text; onText && onText(text); }
        else if (ev.delta.type === "thinking_delta") { thinking += ev.delta.thinking; onThinking && onThinking(thinking); }
      }
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new EngineError("Claude hat diese Anfrage abgelehnt. Bitte anders formulieren.", "refusal");
    // Endgültigen Text aus der Nachricht lesen (Blöcke nach dem letzten Fallback)
    const blocks = msg.content || [];
    let startIdx = 0;
    blocks.forEach((b, i) => { if (b.type === "fallback") startIdx = i + 1; });
    const finalText = blocks.slice(startIdx).filter((b) => b.type === "text").map((b) => b.text).join("");
    return { text: finalText || text, truncated: msg.stop_reason === "max_tokens", usage: msg.usage, model: msg.model };
  } catch (err) {
    throw translateError(err);
  }
}

function translateError(err) {
  if (err instanceof EngineError) return err;
  if (err && err.name === "AbortError") return new EngineError("Abgebrochen.", "abort");
  if (err instanceof Anthropic.APIUserAbortError) return new EngineError("Abgebrochen.", "abort");
  if (err instanceof Anthropic.AuthenticationError) return new EngineError("Der API-Schlüssel wird nicht akzeptiert.", "auth");
  if (err instanceof Anthropic.PermissionDeniedError) return new EngineError("Zugang verweigert: Demo-Code prüfen.", "auth");
  if (err instanceof Anthropic.RateLimitError) return new EngineError("Gerade zu viele Anfragen. Bitte eine Minute warten.", "rate");
  if (err instanceof Anthropic.BadRequestError) return new EngineError(`Anfrage abgelehnt: ${err.message}`, "bad");
  if (err instanceof Anthropic.APIConnectionError) return new EngineError("Keine Verbindung zum Server.", "network");
  if (err instanceof Anthropic.APIError) return new EngineError(`Fehler ${err.status || ""}: ${err.message}`, "api");
  return new EngineError(err && err.message ? err.message : String(err), "unknown");
}
