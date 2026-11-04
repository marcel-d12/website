// Kapellmeister: Oberfläche und Ablauf
import { CONFIG } from "./config.js";
import { COMPOSERS, FORMS, KEYS, METERS, TEMPI, EXPRESSION } from "./composers.js";
import { ENSEMBLES, CUSTOM_CHOICES, buildStaves, scoreLine, voiceLines, SCORE_ORDER } from "./instruments.js";
import { generatePrompt, revisePrompt, repairInstruction, suggestPrompt, SUGGEST_SCHEMA, continuePrompt, CONTINUE_DIRECTIONS, askPrompt } from "./prompts.js";
import { extractTag, normalizeAbc, renderScore, buildModel, excerpt, appendContinuation, withBarComments, stripSetup, titleOf, fileSafe, partialAbc, parsePatches, applyPatches } from "./score.js";
import { checkScore, summarize } from "./checker.js";
import { toMusicXML } from "./musicxml.js";
import { ask, access, readAccessFromHash, EngineError } from "./claude.js";
import { EXAMPLES } from "./examples.js";

const ABCJS = window.ABCJS;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* voll oder privat */ } },
};

const settings = Object.assign({ effort: "low", fast: true, sound: "standard", autoRepair: true, counterpoint: true, volume: 80 }, store.get("km-settings", {}));
const saveSettings = () => store.set("km-settings", settings);
// Umstellung 04.11.: schneller als Standard (weniger Nachdenken, Fast Mode)
if (!settings.v2) { settings.effort = "low"; settings.fast = true; settings.v2 = true; saveSettings(); }

const state = {
  abc: null, vo: null, model: null, issues: [],
  versions: store.get("km-versions", []), current: store.get("km-current", -1),
  markings: [], selection: null, suggestions: null, busy: false, abort: null,
  styleHint: store.get("km-style", ""), chat: [],
};

// ---------------------------------------------------------------- Formular
function fillForm() {
  const comp = $("#fComposer");
  let era = null;
  let group = null;
  for (const c of COMPOSERS) {
    if (c.era !== era) { era = c.era; group = h("optgroup", { label: era }); comp.append(group); }
    group.append(h("option", { value: c.id }, `${c.name} (${c.years})`));
  }
  comp.value = "mozart";
  FORMS.forEach((f) => $("#fForm").append(h("option", { value: f }, f)));
  $("#fForm").value = "Menuett mit Trio";
  for (const [k, e] of Object.entries(ENSEMBLES)) $("#fEnsemble").append(h("option", { value: k }, e.label));
  $("#fEnsemble").append(h("option", { value: "eigene" }, "Eigene Besetzung …"));
  $("#fEnsemble").value = "streichquartett";
  $("#fBars").value = "8";
  KEYS.forEach(([v, l]) => $("#fKey").append(h("option", { value: v }, l)));
  METERS.forEach((m) => $("#fMeter").append(h("option", { value: m }, m || "frei wählen")));
  TEMPI.forEach((t) => $("#fTempo").append(h("option", { value: t }, t || "frei wählen")));
  EXPRESSION.forEach(([v, l]) => $("#fExpression").append(h("option", { value: v }, l)));
  $("#fExpression").value = "reich";
  const custom = $("#customEnsemble");
  for (const c of CUSTOM_CHOICES) {
    const id = `ci-${c.key}`;
    const row = h("label", { class: "ci" }, h("input", { type: "checkbox", id, "data-key": c.key }), c.label);
    if (c.max > 1) row.append(h("select", { "data-count": c.key, "aria-label": `Anzahl ${c.label}` }, h("option", { value: "1" }, "1"), h("option", { value: "2" }, "2")));
    custom.append(row);
  }
  ["Fl", "Ob", "Vl1", "Vl2", "Va", "Vc"].forEach((k) => { const el = $(`#ci-${k}`); if (el) el.checked = true; });
  $("#fEnsemble").addEventListener("change", () => { custom.hidden = $("#fEnsemble").value !== "eigene"; });
  const saved = store.get("km-form", null);
  if (saved) for (const [k, v] of Object.entries(saved)) { const el = $(`#${k}`); if (el && v !== undefined) el.value = v; }
  custom.hidden = $("#fEnsemble").value !== "eigene";
}

function readForm() {
  const composer = COMPOSERS.find((c) => c.id === $("#fComposer").value) || COMPOSERS[0];
  let parts;
  if ($("#fEnsemble").value === "eigene") {
    parts = [];
    for (const c of CUSTOM_CHOICES) {
      if (!$(`#ci-${c.key}`).checked) continue;
      if (c.pair) { parts.push([c.pair[0], 1], [c.pair[1], 1]); continue; }
      const count = c.max > 1 ? +$(`[data-count="${c.key}"]`).value : 1;
      parts.push([c.key, count]);
    }
    parts.sort((a, b) => SCORE_ORDER.indexOf(a[0]) - SCORE_ORDER.indexOf(b[0]));
    if (!parts.length) parts = ENSEMBLES.klavier.parts;
  } else parts = ENSEMBLES[$("#fEnsemble").value].parts;
  const staves = buildStaves(parts);
  const keyVal = $("#fKey").value;
  const form = {
    composer, form: $("#fForm").value, staves, scoreLine: scoreLine(staves), voiceLines: voiceLines(staves),
    key: keyVal, keyLabel: keyVal ? KEYS.find((k) => k[0] === keyVal)[1] : "", meter: $("#fMeter").value,
    tempo: $("#fTempo").value, bars: +$("#fBars").value, expression: $("#fExpression").value, wish: $("#fWish").value.trim(),
  };
  store.set("km-form", { fComposer: $("#fComposer").value, fForm: form.form, fEnsemble: $("#fEnsemble").value, fKey: keyVal, fMeter: form.meter, fTempo: form.tempo, fBars: String(form.bars), fExpression: form.expression, fWish: form.wish });
  return form;
}

// ---------------------------------------------------------------- Partitur
const synthControl = new ABCJS.synth.SynthController();
// Abspielmarke: Linie durch das System, hinterlegter Takt, klingende Noten rot, Taktnummer neben der Wiedergabe
const SVGNS = "http://www.w3.org/2000/svg";
const cursorControl = {
  onStart() { clearPlay(); },
  onEvent(ev) {
    if (ev.measureStart && ev.left === null) return; // zweiter Teil eines Haltebogens über den Taktstrich
    clearPlay(false);
    const els = (ev.elements || []).flat().filter(Boolean);
    els.forEach((el) => el.classList && el.classList.add("km-play"));
    const svg = $("#paper svg");
    if (!svg || ev.left === undefined || ev.left === null) return;
    // Takt bestimmen und hinterlegen
    const cls = (els[0] && els[0].getAttribute && els[0].getAttribute("class")) || "";
    const mm = (cls.match(/abcjs-mm(\d+)/) || [])[1];
    const line = (cls.match(/abcjs-l(\d+)/) || [])[1];
    if (mm !== undefined && line !== undefined) {
      let x1 = Infinity;
      let x2 = -Infinity;
      for (const n of svg.querySelectorAll(`.abcjs-mm${mm}.abcjs-l${line}`)) {
        try { const b = n.getBBox(); if (b.width || b.height) { x1 = Math.min(x1, b.x); x2 = Math.max(x2, b.x + b.width); } } catch (e) { /* unsichtbar */ }
      }
      if (isFinite(x1)) {
        let rect = svg.querySelector(".km-measure");
        if (!rect) { rect = document.createElementNS(SVGNS, "rect"); rect.setAttribute("class", "km-measure"); svg.insertBefore(rect, svg.firstChild); }
        rect.setAttribute("x", x1 - 8);
        rect.setAttribute("width", x2 - x1 + 16);
        rect.setAttribute("y", ev.top - 4);
        rect.setAttribute("height", ev.height + 8);
      }
      if (state.model) $("#playPos").textContent = `Takt ${state.model.label(+mm)}`;
    }
    let cursor = svg.querySelector(".km-cursor");
    if (!cursor) { cursor = document.createElementNS(SVGNS, "line"); cursor.setAttribute("class", "km-cursor"); svg.appendChild(cursor); }
    cursor.setAttribute("x1", ev.left - 3);
    cursor.setAttribute("x2", ev.left - 3);
    cursor.setAttribute("y1", ev.top - 4);
    cursor.setAttribute("y2", ev.top + ev.height + 4);
    keepVisible(cursor);
  },
  onFinished() { clearPlay(); },
};
// Lautstärke: eigener AudioContext mit Gesamtlautstärke, den abcjs für die Wiedergabe nutzt
// (abcjs verbindet seine Klänge mit context.destination; wir leiten das über einen GainNode um).
const master = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    const ctx = new AC();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    Object.defineProperty(ctx, "destination", { get: () => gain, configurable: true });
    ABCJS.synth.registerAudioContext(ctx);
    return { ctx, gain };
  } catch (e) { return null; }
})();
let lastVolume = settings.volume || 80;
function setVolume(v, persist = true) {
  v = Math.max(0, Math.min(100, Math.round(v)));
  if (master) master.gain.gain.setTargetAtTime(Math.pow(v / 100, 2), master.ctx.currentTime, 0.02);
  $("#volume").value = String(v);
  $("#btnMute").classList.toggle("muted", v === 0);
  $("#btnMute").setAttribute("aria-label", v === 0 ? "Ton an" : "Ton aus");
  $("#volWaves").style.display = v === 0 ? "none" : "";
  if (v > 0) lastVolume = v;
  settings.volume = v;
  if (persist) saveSettings();
}

function clearPlay(all = true) {
  $$("#paper .km-play").forEach((el) => el.classList.remove("km-play"));
  if (all) {
    for (const el of $$("#paper .km-cursor, #paper .km-measure")) el.parentNode.removeChild(el);
    $("#playPos").textContent = "";
  }
}
function keepVisible(el) {
  const sheet = $("#sheet");
  const r = el.getBoundingClientRect();
  const s = sheet.getBoundingClientRect();
  if (r.top < s.top + 40 || r.bottom > s.bottom - 40) sheet.scrollBy({ top: r.top - s.top - s.height / 3, behavior: "smooth" });
}
function audioParams() { return { soundFontUrl: CONFIG.soundFonts[settings.sound] || CONFIG.soundFonts.standard, chordsOff: true }; }

function render({ check = true } = {}) {
  if (!state.abc) return;
  state.vo = renderScore("paper", state.abc);
  state.model = buildModel(state.vo, state.abc);
  $("#pieceTitle").textContent = titleOf(state.abc);
  if (check) runCheck();
  applySelectionHighlight();
  requestAnimationFrame(drawMarkings);
  if (ABCJS.synth.supportsAudio()) synthControl.setTune(state.vo, false, audioParams()).catch((e) => console.warn("Audio:", e));
  $("#abcSource").value = state.abc;
}

function renderPartial(text) {
  const part = extractTag(text, "abc");
  if (!part || !part.content) return;
  let abc = part.content;
  if (!part.done) abc = abc.slice(0, abc.lastIndexOf("\n") + 1);
  if (!/^K:/m.test(abc)) return;
  try { renderScore("paper", normalizeAbc(abc)); } catch (e) { /* unvollständig */ }
}

function setAbc(abc, meta) {
  state.abc = abc;
  state.markings = [];
  state.selection = null;
  state.suggestions = null;
  const v = { abc, label: meta.label || titleOf(abc), kind: meta.kind || "edit", time: Date.now(), notes: meta.notes || "", changes: meta.changes || "" };
  if (["neu", "import", "beispiel"].includes(v.kind)) $("#chatLog").replaceChildren();
  state.versions.push(v);
  if (state.versions.length > 30) state.versions.splice(0, state.versions.length - 30);
  state.current = state.versions.length - 1;
  persist();
  render();
  renderMarkings();
  renderSuggestions();
  renderVersions();
  renderNotes(v);
}

function persist() {
  store.set("km-versions", state.versions);
  store.set("km-current", state.current);
}

function restoreVersion(i) {
  const v = state.versions[i];
  if (!v) return;
  state.current = i;
  state.abc = v.abc;
  state.markings = [];
  state.selection = null;
  persist();
  render();
  renderMarkings();
  renderVersions();
  renderNotes(v);
}

function renderNotes(v) {
  const box = $("#pieceNotes");
  box.replaceChildren();
  if (v.notes) box.append(h("p", {}, v.notes));
  if (v.changes) box.append(h("div", { class: "changes" }, h("strong", {}, "Änderungen: "), ...mdLite(v.changes)));
  box.hidden = !v.notes && !v.changes;
}

// ---------------------------------------------------------------- Prüfung
function runCheck() {
  state.issues = checkScore(state.vo, state.model, { counterpoint: settings.counterpoint });
  $$("#paper .km-err, #paper .km-warn, #paper .km-info").forEach((el) => el.classList.remove("km-err", "km-warn", "km-info"));
  for (const x of state.issues) {
    if (x.startChar === undefined) continue;
    const loc = state.model.charToLoc.get(x.startChar);
    if (loc && loc.node) loc.node.classList.add(x.severity === "error" ? "km-err" : x.severity === "warn" ? "km-warn" : "km-info");
  }
  renderIssues();
}

function renderIssues() {
  const c = summarize(state.issues);
  const badge = $("#tabCheckBadge");
  badge.textContent = c.error ? String(c.error) : c.warn ? String(c.warn) : "✓";
  badge.className = "badge " + (c.error ? "bad" : c.warn ? "warn" : "ok");
  $("#checkSummary").textContent = c.error || c.warn || c.info
    ? `${c.error} Fehler, ${c.warn} Warnungen, ${c.info} Satzlehre-Hinweise`
    : "Keine Probleme gefunden: alle Töne im Umfang, Takte vollständig, spielbare Griffe.";
  const list = $("#issueList");
  list.replaceChildren();
  for (const x of state.issues) {
    const label = { error: "Fehler", warn: "Warnung", info: "Hinweis" }[x.severity];
    list.append(h("li", { class: `issue ${x.severity}`, tabindex: "0", onclick: () => focusIssue(x), onkeydown: (e) => { if (e.key === "Enter") focusIssue(x); } },
      h("span", { class: "sev" }, label), h("span", { class: "where" }, x.where), h("span", { class: "msg" }, x.message)));
  }
  $("#btnRepair").disabled = state.busy || !state.issues.some((x) => x.severity !== "info");
}

function focusIssue(x) {
  if (x.voice < 0) return;
  setSelection({ voices: new Set([x.voice]), from: x.measure, to: x.measure });
  const node = $$(`#paper .abcjs-v${x.voice}.abcjs-mm${x.measure}`)[0];
  if (node) keepVisible(node);
}

// ---------------------------------------------------------------- Auswahl und Anmerkungen
let drag = null;
function setupSelection() {
  const sheet = $("#sheet");
  const band = $("#band");
  sheet.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !state.vo || e.target.closest(".km-badge")) return;
    drag = { x: e.clientX, y: e.clientY, moved: false, shift: e.shiftKey, id: e.pointerId };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    drag.moved = true;
    const s = sheet.getBoundingClientRect();
    const x1 = Math.min(drag.x, e.clientX) - s.left + sheet.scrollLeft;
    const y1 = Math.min(drag.y, e.clientY) - s.top + sheet.scrollTop;
    Object.assign(band.style, { display: "block", left: `${x1}px`, top: `${y1}px`, width: `${Math.abs(e.clientX - drag.x)}px`, height: `${Math.abs(e.clientY - drag.y)}px` });
    e.preventDefault();
  });
  window.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    band.style.display = "none";
    if (d.moved) selectRect({ left: Math.min(d.x, e.clientX), right: Math.max(d.x, e.clientX), top: Math.min(d.y, e.clientY), bottom: Math.max(d.y, e.clientY) }, d.shift);
    else selectNearest(e.clientX, e.clientY, d.shift);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.selection) { setSelection(null); } });
  new ResizeObserver(() => requestAnimationFrame(drawMarkings)).observe($("#paper"));
}

function noteNodes() { return $$("#paper .abcjs-note, #paper .abcjs-rest"); }
function locOf(node) {
  const cls = node.getAttribute("class") || "";
  const v = cls.match(/abcjs-v(\d+)/);
  const m = cls.match(/abcjs-mm(\d+)/);
  return v && m ? { voice: +v[1], measure: +m[1] } : null;
}

function selectNearest(x, y, extend) {
  let best = null;
  let bestD = 28;
  for (const n of noteNodes()) {
    const r = n.getBoundingClientRect();
    const dx = Math.max(r.left - x, 0, x - r.right);
    const dy = Math.max(r.top - y, 0, y - r.bottom);
    const d = Math.hypot(dx, dy);
    if (d < bestD) { bestD = d; best = n; }
  }
  if (!best) { if (!extend) setSelection(null); return; }
  const loc = locOf(best);
  if (!loc) return;
  if (extend && state.selection) {
    const s = state.selection;
    s.voices.add(loc.voice);
    setSelection({ voices: s.voices, from: Math.min(s.from, loc.measure), to: Math.max(s.to, loc.measure) });
  } else setSelection({ voices: new Set([loc.voice]), from: loc.measure, to: loc.measure });
}

function selectRect(rect, extend) {
  const voices = extend && state.selection ? new Set(state.selection.voices) : new Set();
  let from = extend && state.selection ? state.selection.from : Infinity;
  let to = extend && state.selection ? state.selection.to : -Infinity;
  let hit = false;
  for (const n of noteNodes()) {
    const r = n.getBoundingClientRect();
    if (r.right < rect.left || r.left > rect.right || r.bottom < rect.top || r.top > rect.bottom) continue;
    const loc = locOf(n);
    if (!loc) continue;
    hit = true;
    voices.add(loc.voice);
    from = Math.min(from, loc.measure);
    to = Math.max(to, loc.measure);
  }
  if (hit) setSelection({ voices, from, to });
}

function setSelection(sel) {
  state.selection = sel && sel.voices.size ? sel : null;
  applySelectionHighlight();
  renderSelectionBox();
  if (state.selection) showTab("revise");
}

function applySelectionHighlight() {
  $$("#paper .km-sel").forEach((el) => el.classList.remove("km-sel"));
  const s = state.selection;
  if (!s) return;
  for (const v of s.voices) for (let m = s.from; m <= s.to; m++) $$(`#paper .abcjs-v${v}.abcjs-mm${m}`).forEach((el) => el.classList.add("km-sel"));
}

function selectionLabels(sel) {
  const voices = [...sel.voices].sort((a, b) => a - b);
  const voicesLabel = voices.map((v) => state.model.voiceLabel(v)).join(", ");
  const a = state.model.label(sel.from);
  const b = state.model.label(sel.to);
  return { voices, voicesLabel, measuresLabel: a === b ? `T. ${a}` : `T. ${a}–${b}` };
}

function renderSelectionBox() {
  const box = $("#selectionBox");
  if (!state.selection) { box.hidden = true; return; }
  const { voicesLabel, measuresLabel } = selectionLabels(state.selection);
  $("#selectionLabel").textContent = `${voicesLabel} · ${measuresLabel}`;
  box.hidden = false;
}

function addMarking(comment) {
  if (!state.selection) return;
  const sel = state.selection;
  const { voices, voicesLabel, measuresLabel } = selectionLabels(sel);
  const ex = voices.map((v) => `[V:${state.model.voices[v].id}] ${excerpt(state.model, state.abc, v, sel.from, sel.to)}`).join("\n");
  state.markings.push({ voices, from: sel.from, to: sel.to, comment: comment || "", voicesLabel, measuresLabel, excerpt: ex });
  $("#markComment").value = "";
  setSelection(null);
  renderMarkings();
  drawMarkings();
}

function renderMarkings() {
  const list = $("#markList");
  list.replaceChildren();
  state.markings.forEach((m, i) => {
    list.append(h("li", { class: "mark" },
      h("span", { class: "num" }, String(i + 1)),
      h("div", {}, h("div", { class: "where" }, `${m.voicesLabel} · ${m.measuresLabel}`), h("div", { class: "msg" }, m.comment || "(ohne Anmerkung)")),
      h("button", { class: "icon", title: "Anmerkung entfernen", "aria-label": "Anmerkung entfernen", onclick: () => { state.markings.splice(i, 1); renderMarkings(); drawMarkings(); } }, "×")));
  });
  $("#markEmpty").hidden = state.markings.length > 0;
}

function drawMarkings() {
  const overlay = $("#overlay");
  overlay.replaceChildren();
  if (!state.vo) return;
  const base = $("#paper").getBoundingClientRect();
  state.markings.forEach((m, i) => {
    const byLine = new Map();
    for (const v of m.voices) for (let mm = m.from; mm <= m.to; mm++) {
      for (const n of $$(`#paper .abcjs-v${v}.abcjs-mm${mm}`)) {
        const l = ((n.getAttribute("class") || "").match(/abcjs-l(\d+)/) || [])[1] || "0";
        const r = n.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        const b = byLine.get(l) || { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
        b.left = Math.min(b.left, r.left); b.top = Math.min(b.top, r.top); b.right = Math.max(b.right, r.right); b.bottom = Math.max(b.bottom, r.bottom);
        byLine.set(l, b);
      }
    }
    let first = true;
    for (const b of byLine.values()) {
      const box = h("div", { class: "km-mark" });
      Object.assign(box.style, { left: `${b.left - base.left - 6}px`, top: `${b.top - base.top - 6}px`, width: `${b.right - b.left + 12}px`, height: `${b.bottom - b.top + 12}px` });
      if (first) box.append(h("span", { class: "km-badge", title: m.comment }, String(i + 1)));
      first = false;
      overlay.append(box);
    }
  });
}

// ---------------------------------------------------------------- Claude-Aufrufe
function promptAbc() { return stripSetup(withBarComments(state.abc, state.model)).trim(); }

function requireAccess() {
  if (access.mode()) return true;
  openSettings("Für diese Funktion braucht Kapellmeister Zugang zu Claude.");
  return false;
}

function setBusy(on, title = "") {
  state.busy = on;
  document.body.classList.toggle("busy", on);
  $$("[data-claude]").forEach((b) => { b.disabled = on; });
  const st = $("#status");
  st.hidden = !on;
  if (on) { $("#statusTitle").textContent = title; $("#statusThinking").textContent = ""; $("#statusProgress").textContent = ""; }
  $("#btnRepair").disabled = on || !state.issues.some((x) => x.severity !== "info");
}

function status(text) { $("#statusProgress").textContent = text; }
function thinkingText(t) {
  const clean = t.replace(/\s+/g, " ").trim();
  $("#statusThinking").textContent = clean.length > 260 ? "… " + clean.slice(-260) : clean;
}

function toast(msg, kind = "info") {
  const t = h("div", { class: `toast ${kind}`, role: "status" }, msg);
  $("#toasts").append(t);
  setTimeout(() => t.remove(), kind === "error" ? 9000 : 5000);
}

const PHASES = { wait: "verbindet …", think: "plant …", write: "schreibt die Noten …" };

async function runClaude({ title, user, schema = null, live = false, maxTokens }) {
  state.abort = new AbortController();
  setBusy(true, title);
  const started = Date.now();
  let lastRender = 0;
  const timer = setInterval(() => { $("#statusTime").textContent = `${Math.round((Date.now() - started) / 1000)} s`; }, 1000);
  try {
    const res = await ask({
      user, schema, effort: settings.effort, fast: settings.fast, maxTokens, signal: state.abort.signal,
      onThinking: thinkingText,
      onPhase: (p, fast) => { $("#statusTitle").textContent = `${title.replace(/ …$/, "")}: ${PHASES[p] || ""}${fast ? " (Turbo)" : ""}`; },
      onText: (t) => {
        const patches = (t.match(/<\/takt>/g) || []).length;
        status(patches ? `${patches} Takte überarbeitet` : `${t.length.toLocaleString("de-DE")} Zeichen geschrieben`);
        if (live && Date.now() - lastRender > 1200) { lastRender = Date.now(); renderPartial(t); }
      },
    });
    if (res.truncated) toast("Die Antwort wurde abgeschnitten (zu lang). Kürzere Länge oder kleinere Besetzung wählen.", "error");
    return res;
  } catch (err) {
    err.seconds = Math.round((Date.now() - started) / 1000);
    throw err;
  } finally {
    clearInterval(timer);
    setBusy(false);
    state.abort = null;
  }
}

function handleError(err, kept = false) {
  const after = err.seconds ? ` nach ${err.seconds} s` : "";
  const keptText = kept ? " Das bisher Geschriebene steht als eigene Version im Verlauf." : "";
  if (err instanceof EngineError && err.kind === "abort") { toast(`Abgebrochen${after}.${keptText}`, kept ? "warn" : "info"); if (!kept && state.abc) render(); return; }
  if (err instanceof EngineError && (err.kind === "setup" || err.kind === "auth")) openSettings(err.message);
  else toast(`${err.message || String(err)}${after ? ` (${after.trim()})` : ""}${keptText}`, "error");
  if (!kept && state.abc) render();
}

// Bei Abbruch: geschriebenen Teil einer Komposition als Version behalten
function keepPartialScore(err, label) {
  const abc = partialAbc(err && err.partialText);
  if (!abc) return false;
  try {
    setAbc(normalizeAbc(abc), { kind: "teilergebnis", label: `${label} (abgebrochen)`, notes: "Abgebrochenes Teilergebnis. Mit „Weiter“ lässt es sich fortsetzen." });
    return true;
  } catch (e) { return false; }
}

// Antwort einer Überarbeitung übernehmen: vollständige Datei oder einzelne Takte
function applyRevision(text, meta, partial = false) {
  const full = extractTag(text, "abc");
  if (full && full.content && (full.done || partial)) {
    const abc = partial ? partialAbc(text) : full.content;
    if (!abc) return false;
    setAbc(normalizeAbc(abc), meta);
    return true;
  }
  const patches = parsePatches(text);
  if (!patches.length) return false;
  const r = applyPatches(state.abc, state.model, patches);
  if (!r.applied) return false;
  const changes = extractTag(text, "aenderungen");
  setAbc(normalizeAbc(r.abc), { ...meta, changes: (changes && changes.content) || `${r.applied} Takte geändert` });
  if (r.failed.length) toast(`${r.failed.length} Takt-Änderungen ließen sich nicht zuordnen.`, "warn");
  return true;
}

async function compose() {
  if (state.busy || !requireAccess()) return;
  const f = readForm();
  state.styleHint = `${f.composer.name}: ${f.composer.style}`;
  store.set("km-style", state.styleHint);
  try {
    const res = await runClaude({ title: `Claude komponiert im Stil von ${f.composer.name} …`, user: generatePrompt(f), live: true });
    const abc = extractTag(res.text, "abc");
    if (!abc || !abc.content) throw new EngineError("Die Antwort enthielt keine Noten. Bitte erneut versuchen.", "format");
    const notiz = extractTag(res.text, "notiz");
    setAbc(normalizeAbc(abc.content), { kind: "neu", label: `Neu: ${f.form}, ${f.composer.name}`, notes: notiz ? notiz.content : "" });
    $("#composeCard").open = false;
    await maybeAutoRepair();
  } catch (err) {
    const kept = keepPartialScore(err, `Neu: ${f.form}, ${f.composer.name}`);
    if (kept) $("#composeCard").open = false;
    handleError(err, kept);
  }
}

async function maybeAutoRepair() {
  if (!settings.autoRepair) return;
  const serious = state.issues.filter((x) => x.severity === "error" || (x.severity === "warn" && ["range", "poly", "comfort"].includes(x.code)));
  if (!serious.some((x) => x.severity === "error")) return;
  toast(`Prüfung: ${serious.length} Probleme gefunden. Claude korrigiert automatisch …`);
  await repair(serious, true);
}

async function repair(list, auto = false) {
  if (state.busy || !requireAccess()) return;
  const issues = list || state.issues.filter((x) => x.severity !== "info");
  if (!issues.length) return;
  try {
    const res = await runClaude({
      title: auto ? "Automatische Korrektur der gefundenen Probleme …" : "Claude behebt die gefundenen Probleme …",
      user: revisePrompt({ abc: promptAbc(), voices: state.model.voices, markings: [], instruction: repairInstruction(), issues }),
      live: true,
    });
    const before = state.issues.filter((x) => x.severity === "error").length;
    const changes = extractTag(res.text, "aenderungen");
    const meta = { kind: "korrektur", label: auto ? "Automatische Korrektur" : "Korrektur nach Prüfung", changes: changes ? changes.content : "" };
    if (!applyRevision(res.text, meta)) throw new EngineError("Die Antwort enthielt keine Änderungen.", "format");
    const after = state.issues.filter((x) => x.severity === "error").length;
    toast(`Korrektur fertig: ${before} → ${after} Fehler.`, after ? "warn" : "ok");
  } catch (err) {
    const kept = !!(err.partialText && applyRevision(err.partialText, { kind: "teilergebnis", label: "Korrektur (abgebrochen)" }, true));
    handleError(err, kept);
  }
}

async function revise() {
  if (state.busy || !state.abc || !requireAccess()) return;
  const instruction = $("#reviseText").value.trim();
  if (!instruction && !state.markings.length) { toast("Erst eine Stelle markieren und kommentieren oder einen Wunsch eingeben."); return; }
  try {
    const res = await runClaude({
      title: "Claude überarbeitet die Partitur …",
      user: revisePrompt({ abc: promptAbc(), voices: state.model.voices, markings: state.markings, instruction, issues: [] }),
      live: true,
    });
    const changes = extractTag(res.text, "aenderungen");
    const label = instruction ? `Überarbeitet: ${instruction.slice(0, 40)}${instruction.length > 40 ? "…" : ""}` : `Überarbeitet (${state.markings.length} Anmerkungen)`;
    if (!applyRevision(res.text, { kind: "überarbeitet", label, changes: changes ? changes.content : "" })) throw new EngineError("Die Antwort enthielt keine Änderungen.", "format");
    $("#reviseText").value = "";
    await maybeAutoRepair();
  } catch (err) {
    const kept = !!(err.partialText && applyRevision(err.partialText, { kind: "teilergebnis", label: "Überarbeitung (abgebrochen)" }, true));
    handleError(err, kept);
  }
}

async function suggest() {
  if (state.busy || !state.abc || !requireAccess()) return;
  try {
    const res = await runClaude({
      title: "Claude begutachtet die Partitur …",
      user: suggestPrompt({ abc: promptAbc(), voices: state.model.voices, styleHint: state.styleHint }),
      schema: SUGGEST_SCHEMA, maxTokens: 16000,
    });
    state.suggestions = JSON.parse(res.text);
    renderSuggestions();
  } catch (err) { handleError(err); }
}

function suggestionToMarking(s) {
  const voices = s.stimmen.map((id) => state.model.voices.findIndex((v) => v.id === id)).filter((i) => i >= 0);
  if (!voices.length) state.model.voices.forEach((v, i) => voices.push(i));
  const off = state.model.hasPickup ? 0 : 1;
  const from = Math.max(0, Math.min(s.takt_von, s.takt_bis) - off);
  const to = Math.min(state.model.measureCount - 1, Math.max(s.takt_von, s.takt_bis) - off);
  return { voices: new Set(voices), from, to };
}

function renderSuggestions() {
  const box = $("#suggestBox");
  box.replaceChildren();
  const s = state.suggestions;
  if (!s) { box.hidden = true; return; }
  box.hidden = false;
  box.append(h("p", { class: "verdict" }, s.gesamturteil));
  const list = h("ul", { class: "suggestions" });
  s.vorschlaege.forEach((v, i) => {
    const cb = h("input", { type: "checkbox", checked: true, "data-i": String(i), "aria-label": `Vorschlag ${i + 1} auswählen` });
    list.append(h("li", {},
      h("label", { class: "sg-head" }, cb, h("span", { class: "cat" }, v.kategorie), h("strong", {}, v.titel)),
      h("div", { class: "where" }, `${v.stimmen.join(", ")} · T. ${v.takt_von}${v.takt_bis !== v.takt_von ? "–" + v.takt_bis : ""}`),
      h("p", {}, v.begruendung),
      h("div", { class: "row" },
        h("button", { class: "ghost small", onclick: () => setSelection(suggestionToMarking(v)) }, "Zeigen"),
        h("button", { class: "ghost small", onclick: () => { setSelection(suggestionToMarking(v)); addMarking(v.anweisung); } }, "Als Anmerkung"))));
  });
  box.append(list);
  box.append(h("button", { class: "primary", "data-claude": true, onclick: applySuggestions }, "Ausgewählte Vorschläge umsetzen"));
}

async function applySuggestions() {
  const chosen = $$("#suggestBox input[type=checkbox]").filter((c) => c.checked).map((c) => state.suggestions.vorschlaege[+c.dataset.i]);
  if (!chosen.length) return;
  for (const v of chosen) { setSelection(suggestionToMarking(v)); addMarking(`${v.titel}: ${v.anweisung}`); }
  state.suggestions = null;
  renderSuggestions();
  await revise();
}

// Frage-Antwort-Spiel: drei Fortsetzungen
async function continueGame() {
  if (state.busy || !state.abc || !requireAccess()) return;
  const bars = +$("#contBars").value;
  const firstBar = state.model.label(state.model.measureCount - 1) + 1;
  const dlg = $("#contDialog");
  const tabs = $("#contTabs");
  const panes = $("#contPanes");
  tabs.replaceChildren();
  panes.replaceChildren();
  const results = [];
  CONTINUE_DIRECTIONS.forEach((d, i) => {
    tabs.append(h("button", { role: "tab", class: i === 0 ? "active" : "", onclick: () => showContTab(i) }, `${i + 1} · ${d.label}`));
    panes.append(h("div", { class: "cont-pane", hidden: i !== 0 },
      h("p", { class: "cont-status" }, "Claude schreibt …"), h("div", { class: "cont-paper", id: `contPaper${i}` }), h("div", { class: "cont-audio", id: `contAudio${i}` }),
      h("p", { class: "cont-note" }), h("div", { class: "row" }, h("button", { class: "primary", disabled: true, onclick: () => acceptContinuation(i) }, "Diese Fortsetzung übernehmen"))));
  });
  dlg.showModal();
  state.abort = new AbortController();
  setBusy(true, `Drei Fortsetzungen über ${bars} Takte …`);
  const header = stripSetup(state.abc).split("\n");
  const kIdx = header.findIndex((l) => /^K:/.test(l));
  const head = header.slice(0, kIdx + 1).join("\n");
  const base = promptAbc();
  let done = 0;
  await Promise.all(CONTINUE_DIRECTIONS.map(async (d, i) => {
    const pane = panes.children[i];
    try {
      const res = await ask({ user: continuePrompt({ abc: base, voices: state.model.voices, bars, firstBar, direction: d }), effort: settings.effort, fast: settings.fast, maxTokens: 16000, signal: state.abort.signal,
        onThinking: (t) => { $(".cont-status", pane).textContent = "Claude überlegt: " + t.replace(/\s+/g, " ").slice(-140); } });
      const cont = extractTag(res.text, "abc");
      const note = extractTag(res.text, "notiz");
      if (!cont || !cont.content) throw new Error("keine Noten erhalten");
      results[i] = cont.content;
      $(".cont-status", pane).textContent = "";
      $(".cont-note", pane).textContent = note ? note.content : "";
      const preview = normalizeAbc(head + "\n" + cont.content);
      const vo = renderScore(`contPaper${i}`, preview, { staffwidth: 760 });
      const sc = new ABCJS.synth.SynthController();
      sc.load(`#contAudio${i}`, null, { displayPlay: true, displayProgress: true });
      sc.setTune(vo, false, audioParams()).catch(() => {});
      $("button.primary", pane).disabled = false;
    } catch (err) {
      $(".cont-status", pane).textContent = `Fehler: ${err.message}`;
    } finally {
      done++;
      status(`${done} von 3 fertig`);
    }
  }));
  setBusy(false);
  state.abort = null;
  dlg.results = results;
}

function showContTab(i) {
  $$("#contTabs button").forEach((b, k) => b.classList.toggle("active", k === i));
  $$("#contPanes .cont-pane").forEach((p, k) => { p.hidden = k !== i; });
}

async function acceptContinuation(i) {
  const dlg = $("#contDialog");
  const cont = dlg.results && dlg.results[i];
  if (!cont) return;
  dlg.close();
  setAbc(normalizeAbc(appendContinuation(stripSetup(state.abc), cont)), { kind: "fortgesetzt", label: `Fortgesetzt (${CONTINUE_DIRECTIONS[i].label})` });
  await maybeAutoRepair();
}

// Fragen
async function askQuestion() {
  if (state.busy || !state.abc || !requireAccess()) return;
  const q = $("#askText").value.trim();
  if (!q) return;
  $("#askText").value = "";
  const log = $("#chatLog");
  log.append(h("div", { class: "msg user" }, q));
  const answer = h("div", { class: "msg claude" }, h("em", {}, "Claude denkt nach …"));
  log.append(answer);
  answer.scrollIntoView({ block: "nearest" });
  try {
    state.abort = new AbortController();
    setBusy(true, "Claude beantwortet die Frage …");
    const res = await ask({ user: askPrompt({ abc: promptAbc(), voices: state.model.voices, question: q, markings: state.markings }), effort: settings.effort, fast: settings.fast, maxTokens: 12000, signal: state.abort.signal,
      onText: (t) => { answer.replaceChildren(...mdLite(t)); } });
    answer.replaceChildren(...mdLite(res.text));
  } catch (err) {
    answer.replaceChildren(h("em", {}, `Fehler: ${err.message}`));
  } finally { setBusy(false); state.abort = null; }
}

// sehr kleines Markdown: Absätze, Listen, **fett**
function mdLite(text) {
  const out = [];
  let list = null;
  for (const raw of String(text).split("\n")) {
    const line = raw.trim();
    if (!line) { list = null; continue; }
    const li = line.match(/^[-*•]\s+(.*)$/);
    if (li) {
      if (!list) { list = h("ul"); out.push(list); }
      list.append(h("li", {}, ...inline(li[1])));
    } else { list = null; out.push(h("p", {}, ...inline(line))); }
  }
  return out;
}
function inline(t) {
  return t.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p) => (p.startsWith("**") ? h("strong", {}, p.slice(2, -2)) : document.createTextNode(p)));
}

// ---------------------------------------------------------------- Export
function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function exportAs(kind) {
  if (!state.abc) return;
  const name = fileSafe(titleOf(state.abc));
  try {
    if (kind === "musicxml") download(`${name}.musicxml`, toMusicXML(state.vo, state.model), "application/vnd.recordare.musicxml+xml");
    else if (kind === "abc") download(`${name}.abc`, state.abc, "text/vnd.abc");
    else if (kind === "midi") {
      const data = ABCJS.synth.getMidiFile(state.abc, { midiOutputType: "binary", chordsOff: true });
      download(`${name}.mid`, new Blob([data[0]], { type: "audio/midi" }));
    } else if (kind === "svg") {
      const svg = $("#paper svg").cloneNode(true);
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const vb = (svg.getAttribute("viewBox") || "0 0 1000 1000").split(/\s+/).map(Number);
      svg.setAttribute("width", vb[2]);
      svg.setAttribute("height", vb[3]);
      svg.querySelectorAll(".km-sel, .km-play, .km-err, .km-warn, .km-info").forEach((el) => el.classList.remove("km-sel", "km-play", "km-err", "km-warn", "km-info"));
      for (const el of svg.querySelectorAll(".km-cursor, .km-measure")) el.parentNode.removeChild(el);
      download(`${name}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n` + svg.outerHTML, "image/svg+xml");
    } else if (kind === "wav") {
      toast("WAV wird berechnet (Klänge laden, das kann etwas dauern) …");
      const synth = new ABCJS.synth.CreateSynth();
      await synth.init({ visualObj: state.vo, options: audioParams() });
      await synth.prime();
      const url = synth.download();
      const a = h("a", { href: url, download: `${name}.wav` });
      document.body.append(a);
      a.click();
      a.remove();
    } else if (kind === "pdf") {
      const old = document.title;
      document.title = titleOf(state.abc);
      $$("#paper .km-sel, #paper .km-err, #paper .km-warn, #paper .km-info").forEach((el) => el.classList.add("km-noprint"));
      window.print();
      document.title = old;
    }
  } catch (err) {
    toast(`Export fehlgeschlagen: ${err.message || err}`, "error");
  }
}

// ---------------------------------------------------------------- Import
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ($(`script[src="${src}"]`)) return resolve();
    const s = h("script", { src });
    s.onload = resolve;
    s.onerror = () => reject(new Error(`${src} nicht geladen`));
    document.head.append(s);
  });
}

async function importFile(file) {
  try {
    let text;
    if (/\.mxl$/i.test(file.name)) text = await unzipMusicXML(await file.arrayBuffer());
    else text = await file.text();
    let abc;
    if (/^\s*X:/m.test(text) && !/<score-(partwise|timewise)/.test(text)) abc = text;
    else {
      await loadScript("vendor/jquery.min.js");
      await loadScript("vendor/xml2abc.js");
      const xml = window.jQuery.parseXML(text);
      const [out, log] = window.vertaal(xml, { u: 0, b: 4, n: 0, c: 0, v: 0, d: 0, m: 0, x: 0, t: 0, v1: 0, noped: 0, p: "" });
      if (!out || !/K:/.test(out)) throw new Error(log || "MusicXML konnte nicht gelesen werden");
      abc = out;
    }
    setAbc(normalizeAbc(abc), { kind: "import", label: `Importiert: ${file.name}` });
    toast(`„${file.name}“ geladen. Markieren, prüfen, überarbeiten oder fortsetzen.`, "ok");
  } catch (err) {
    toast(`Import fehlgeschlagen: ${err.message || err}`, "error");
  }
}

// .mxl ist ein ZIP-Archiv: Zentralverzeichnis lesen und die Partitur entpacken
async function unzipMusicXML(buf) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("keine gültige .mxl-Datei");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = [];
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
    entries.push({ name, method, csize, off });
    p += 46 + nlen + elen + clen;
  }
  const read = async (e) => {
    const lnlen = dv.getUint16(e.off + 26, true);
    const lelen = dv.getUint16(e.off + 28, true);
    const data = new Uint8Array(buf, e.off + 30 + lnlen + lelen, e.csize);
    if (e.method === 0) return dec.decode(data);
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  };
  let target = entries.find((e) => !/^META-INF\//.test(e.name) && /\.(xml|musicxml)$/i.test(e.name));
  const container = entries.find((e) => e.name === "META-INF/container.xml");
  if (container) {
    const m = (await read(container)).match(/full-path="([^"]+)"/);
    if (m) target = entries.find((e) => e.name === m[1]) || target;
  }
  if (!target) throw new Error("keine Partitur im Archiv");
  return read(target);
}

// ---------------------------------------------------------------- Verlauf
function renderVersions() {
  const list = $("#versionList");
  list.replaceChildren();
  state.versions.map((v, i) => [v, i]).reverse().forEach(([v, i]) => {
    const time = new Date(v.time).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    list.append(h("li", { class: i === state.current ? "current" : "" },
      h("button", { class: "linkish", onclick: () => restoreVersion(i) }, h("span", { class: "vnum" }, `V${i + 1}`), h("span", {}, v.label)),
      h("span", { class: "meta" }, `${v.kind} · ${time}${i === state.current ? " · aktuell" : ""}`)));
  });
  $("#versionCount").textContent = String(state.versions.length);
}

// ---------------------------------------------------------------- Einstellungen und Dialoge
function openSettings(reason = "") {
  const dlg = $("#settingsDialog");
  $("#settingsReason").textContent = reason;
  $("#settingsReason").hidden = !reason;
  $("#setCode").value = access.code;
  $("#setKey").value = access.apiKey;
  $("#setProxy").value = access.proxyUrl;
  $("#setEffort").value = settings.effort;
  $("#setFast").checked = settings.fast;
  $("#setSound").value = settings.sound;
  $("#setAutoRepair").checked = settings.autoRepair;
  $("#setCounterpoint").checked = settings.counterpoint;
  $("#proxyRow").hidden = !access.proxyUrl && !CONFIG.proxyUrl;
  dlg.showModal();
}

function saveSettingsDialog() {
  access.code = $("#setCode").value.trim();
  access.apiKey = $("#setKey").value.trim();
  access.proxyUrl = $("#setProxy").value.trim() === CONFIG.proxyUrl ? "" : $("#setProxy").value.trim();
  const soundChanged = settings.sound !== $("#setSound").value;
  const cpChanged = settings.counterpoint !== $("#setCounterpoint").checked;
  settings.effort = $("#setEffort").value;
  settings.fast = $("#setFast").checked;
  settings.sound = $("#setSound").value;
  settings.autoRepair = $("#setAutoRepair").checked;
  settings.counterpoint = $("#setCounterpoint").checked;
  saveSettings();
  updateAccessBadge();
  if ((soundChanged || cpChanged) && state.abc) render();
}

function updateAccessBadge() {
  const d = access.describe();
  const b = $("#accessBadge");
  b.textContent = d ? `Claude verbunden · ${d}` : "Claude nicht verbunden";
  b.className = "access " + (d ? "on" : "off");
}

function showTab(name) {
  $$(".tabs [role=tab]").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
  $$(".tabpane").forEach((p) => { p.hidden = p.dataset.pane !== name; });
}

// ---------------------------------------------------------------- Start
function wire() {
  $("#btnCompose").addEventListener("click", compose);
  $("#volume").addEventListener("input", (e) => setVolume(+e.target.value));
  $("#btnMute").addEventListener("click", () => setVolume(settings.volume > 0 ? 0 : lastVolume || 80));
  $("#btnRevise").addEventListener("click", revise);
  $("#btnSuggest").addEventListener("click", suggest);
  $("#btnRepair").addEventListener("click", () => repair());
  $("#btnContinue").addEventListener("click", continueGame);
  $("#btnAsk").addEventListener("click", askQuestion);
  $("#askText").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion(); } });
  $("#btnCancel").addEventListener("click", () => state.abort && state.abort.abort());
  $("#btnAddMark").addEventListener("click", () => addMarking($("#markComment").value.trim()));
  $("#btnClearSel").addEventListener("click", () => setSelection(null));
  $("#btnAskSel").addEventListener("click", () => { addMarking($("#markComment").value.trim()); showTab("ask"); $("#askText").focus(); });
  $$(".chip[data-chip]").forEach((c) => c.addEventListener("click", () => { const t = $("#markComment"); t.value = (t.value ? t.value + " " : "") + c.dataset.chip; t.focus(); }));
  $("#markComment").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addMarking($("#markComment").value.trim()); } });
  $$(".tabs [role=tab]").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
  $("#btnSettings").addEventListener("click", () => openSettings());
  $("#accessBadge").addEventListener("click", () => openSettings());
  $("#settingsForm").addEventListener("submit", () => saveSettingsDialog());
  $("#btnAbout").addEventListener("click", () => $("#aboutDialog").showModal());
  $$("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  $("#btnApplySource").addEventListener("click", () => {
    const txt = $("#abcSource").value;
    if (txt.trim() && txt !== state.abc) setAbc(normalizeAbc(txt), { kind: "von Hand", label: "Quelltext bearbeitet" });
  });
  $("#btnCheck").addEventListener("click", () => { runCheck(); showTab("check"); });
  $$("[data-export]").forEach((b) => b.addEventListener("click", () => { $("#exportMenu").open = false; exportAs(b.dataset.export); }));
  $$("[data-example]").forEach((b) => b.addEventListener("click", () => {
    $("#exampleMenu").open = false;
    const ex = EXAMPLES.find((e) => e.id === b.dataset.example);
    setAbc(normalizeAbc(ex.abc), { kind: "beispiel", label: `Beispiel: ${ex.label}` });
    if (ex.id === "pruefdemo") showTab("check");
  }));
  $("#fileInput").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ""; });
  const sheet = $("#sheet");
  sheet.addEventListener("dragover", (e) => { e.preventDefault(); sheet.classList.add("dropping"); });
  sheet.addEventListener("dragleave", () => sheet.classList.remove("dropping"));
  sheet.addEventListener("drop", (e) => { e.preventDefault(); sheet.classList.remove("dropping"); const f = e.dataTransfer.files[0]; if (f) importFile(f); });
  document.addEventListener("click", (e) => { $$("details.menu[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });
  window.addEventListener("afterprint", () => $$(".km-noprint").forEach((el) => el.classList.remove("km-noprint")));
}

function init() {
  fillForm();
  wire();
  setupSelection();
  if (ABCJS.synth.supportsAudio()) synthControl.load("#audio", cursorControl, { displayLoop: true, displayRestart: true, displayPlay: true, displayProgress: true, displayWarp: true });
  else $("#audio").textContent = "Dieser Browser kann keine Audiowiedergabe.";
  setVolume(settings.volume ?? 80, false);
  if (!master) $(".volume").hidden = true;
  const fromLink = readAccessFromHash();
  updateAccessBadge();
  if (fromLink && access.mode()) toast("Demo-Zugang aktiv. Viel Spaß beim Komponieren!", "ok");
  if (state.versions.length && state.versions[state.current]) restoreVersion(state.current);
  else {
    const ex = EXAMPLES[0];
    state.versions = [];
    setAbc(normalizeAbc(ex.abc), { kind: "beispiel", label: `Beispiel: ${ex.label}` });
  }
  showTab("revise");
}

init();
