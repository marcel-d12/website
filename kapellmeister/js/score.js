// ABC-Hilfsfunktionen: Kopf lesen, normalisieren, Stimmen und Takte aus der gerenderten Partitur ableiten.
import { INSTRUMENTS, guessInstrument } from "./instruments.js";

const ABCJS = window.ABCJS;

// Text zwischen <tag> und </tag>; liefert auch einen unvollständigen Teil während des Streamings
export function extractTag(text, tag) {
  const open = text.indexOf(`<${tag}>`);
  if (open < 0) return null;
  const start = open + tag.length + 2;
  const close = text.indexOf(`</${tag}>`, start);
  return { content: text.slice(start, close < 0 ? undefined : close).replace(/^\s*\n/, "").replace(/\s+$/, ""), done: close >= 0 };
}

const DECORATION_FIXES = [
  [/!sforzando!/g, "!sfz!"], [/!sf!/g, "!sfz!"], [/!fz!/g, "!sfz!"], [/!fp!/g, '"_fp"'], [/!rfz!/g, '"_rfz"'],
  [/!rf!/g, '"_rf"'], [/!sfp!/g, '"_sfp"'], [/!staccato!/g, "."], [/!accent!/g, "!>!"], [/!pizz\.?!/g, '"^pizz."'],
  [/!arco!/g, '"^arco"'], [/!cresc\.?!/g, '"_cresc."'], [/!dim\.?!/g, '"_dim."'], [/!dimin\.?!/g, '"_dim."'],
];

// Bringt eine ABC-Datei in eine Form, die abcjs sicher liest, und setzt die Instrumentenklänge
export function normalizeAbc(raw) {
  let abc = (raw || "").replace(/\r\n?/g, "\n");
  abc = abc.replace(/^```[a-z]*\s*\n?/gm, "").replace(/```\s*$/gm, "");
  for (const [re, rep] of DECORATION_FIXES) abc = abc.replace(re, rep);
  let lines = abc.split("\n");
  // Leerzeilen beenden in ABC ein Stück: entfernen
  lines = lines.filter((l) => l.trim() !== "");
  // xml2abc-Zeilenumbruchzeichen ($) und I:linebreak kennt abcjs nicht
  if (lines.some((l) => /^I:linebreak/.test(l))) {
    lines = lines.filter((l) => !/^I:linebreak/.test(l)).map((l) => (/^[A-Za-z]:|^%/.test(l) ? l : l.replace(/\$/g, "")));
  }
  // Alles vor X: weg, X: sicherstellen
  const xi = lines.findIndex((l) => /^X:/.test(l));
  if (xi > 0) lines = lines.slice(xi);
  if (xi < 0) lines.unshift("X:1");
  // eigene MIDI-Klänge setzen (Block mit Markern, damit er sich später wieder entfernen lässt)
  lines = stripSetup(lines.join("\n")).split("\n").filter((l) => l.trim() !== "");
  const head = parseHeader(lines.join("\n"));
  const ki = lines.findIndex((l) => /^K:/.test(l));
  if (ki >= 0) {
    const setup = [];
    for (const v of head.voices) {
      const key = guessInstrument(v.id, v.name);
      if (key && INSTRUMENTS[key]) {
        setup.push(`V:${v.id}`);
        setup.push(`%%MIDI program ${INSTRUMENTS[key].program}`);
      }
    }
    // nach K: und direkt folgenden Stimmdefinitionen einfügen
    let at = ki + 1;
    while (at < lines.length && (/^V:\s*\S+\s+\S/.test(lines[at]) || /^%%/.test(lines[at]))) at++;
    if (setup.length) lines.splice(at, 0, SETUP_START, ...setup, SETUP_END);
  }
  return lines.join("\n") + "\n";
}

const SETUP_START = "% Klang (Kapellmeister)";
const SETUP_END = "% Klang Ende";

// Entfernt den Klang-Block und alle %%MIDI-program-Zeilen (für Prompts und vor dem Neusetzen)
export function stripSetup(abc) {
  const out = [];
  let skip = false;
  for (const line of abc.split("\n")) {
    const t = line.trim();
    if (t === SETUP_START) { skip = true; continue; }
    if (t === SETUP_END) { skip = false; continue; }
    if (skip || /^%%MIDI\s+program/.test(t)) continue;
    out.push(line);
  }
  return out.join("\n");
}

// Kopf lesen: V:-Definitionen und %%score-Reihenfolge
export function parseHeader(abc) {
  const lines = abc.split("\n");
  const voices = [];
  const byId = {};
  let scoreLine = null;
  let inHeader = true;
  for (const line of lines) {
    if (/^K:/.test(line)) { inHeader = false; continue; }
    if (/^%%(score|staves)\b/.test(line) && !scoreLine) scoreLine = line;
    const m = line.match(/^V:\s*([^\s\]]+)(.*)$/);
    if (m && !byId[m[1]]) {
      const rest = m[2] || "";
      const v = {
        id: m[1],
        name: attr(rest, "name") ?? attr(rest, "nm") ?? "",
        snm: attr(rest, "snm") ?? attr(rest, "sname") ?? "",
        clef: (rest.match(/clef=(\S+)/) || rest.match(/(?:^|\s)((?:treble|bass|alto|tenor)(?:[+-]8)?)(?=\s|$)/) || [])[1] || "treble",
        inHeader,
      };
      byId[v.id] = v;
      voices.push(v);
    }
  }
  // auch Stimmen, die nur im Körper als [V:x] auftauchen
  const inline = abc.matchAll(/\[V:\s*([^\s\]]+)/g);
  for (const m of inline) if (!byId[m[1]]) { byId[m[1]] = { id: m[1], name: "", snm: "", clef: "treble" }; voices.push(byId[m[1]]); }
  let order = voices.map((v) => v.id);
  if (scoreLine) {
    const ids = scoreLine.replace(/^%%(score|staves)/, "").match(/[^\s()[\]{}|]+/g) || [];
    const known = ids.filter((id) => byId[id]);
    if (known.length) order = [...known, ...order.filter((id) => !known.includes(id))];
  }
  return { voices: order.map((id) => byId[id]), scoreLine };
}

function attr(text, name) {
  const m = text.match(new RegExp(`\\b${name}="([^"]*)"`)) || text.match(new RegExp(`\\b${name}=(\\S+)`));
  return m ? m[1] : null;
}

// Spielerzahl aus Namen wie „2 Oboen“ oder „Ob. 1.2“
function playersFrom(v) {
  const t = `${v.name} ${v.snm} ${v.id}`;
  if (/^2\s/.test(v.name) || /\b1\.2\b|\b3\.4\b/.test(v.snm) || /^[A-Za-z]+(12|34)$/.test(v.id) || /a2|à 2/.test(t)) return 2;
  return 1;
}

export function renderScore(target, abc, extra = {}) {
  const vo = ABCJS.renderAbc(target, abc, {
    add_classes: true,
    selectTypes: false,
    responsive: "resize",
    staffwidth: 980,
    paddingtop: 10,
    paddingbottom: 24,
    paddingleft: 10,
    paddingright: 10,
    format: {
      titlefont: '"Georgia" 22 bold',
      composerfont: '"Georgia" 13 italic',
      tempofont: '"Georgia" 12 bold',
      partsfont: '"Georgia" 13',
      voicefont: '"Georgia" 12',
      annotationfont: '"Georgia" 12 italic',
      measurefont: '"Georgia" 10 italic',
    },
    ...extra,
  })[0];
  return vo;
}

const DUR_EPS = 1e-6;

// Modell der gerenderten Partitur: Stimmen, Takte, Elemente
export function buildModel(vo, abc) {
  const head = parseHeader(abc);
  const voices = head.voices.map((v, i) => {
    const key = guessInstrument(v.id, v.name);
    return { index: i, id: v.id, name: v.name || (key && INSTRUMENTS[key] ? INSTRUMENTS[key].name : v.id), snm: v.snm, clef: v.clef, key, def: key ? INSTRUMENTS[key] : null, players: playersFrom(v) };
  });
  // Klaviernamen für die linke Hand ergänzen
  voices.forEach((v, i) => {
    if (!v.name && v.def && v.def.group && i > 0 && voices[i - 1].def && voices[i - 1].def.group === v.def.group) {
      v.name = `${voices[i - 1].name} (links)`;
    }
  });
  const meter = meterOf(vo);
  const cells = new Map(); // "v:mm" -> { elements: [], duration }
  const charToLoc = new Map();
  let maxMeasure = -1;
  const lines = vo.lines || [];
  for (let l = 0; l < lines.length; l++) {
    const staffs = lines[l].staff || [];
    let g = 0;
    for (let s = 0; s < staffs.length; s++) {
      const vs = staffs[s].voices || [];
      for (let v = 0; v < vs.length; v++, g++) {
        let mult = 1;
        for (const el of vs[v]) {
          if (el.el_type !== "note") continue;
          if (el.startTriplet) mult = el.tripletMultiplier || 1;
          const node = el.abselem && el.abselem.elemset && el.abselem.elemset[0];
          const cls = node && node.getAttribute ? node.getAttribute("class") || "" : "";
          const mmMatch = cls.match(/abcjs-mm(\d+)/);
          const vMatch = cls.match(/abcjs-v(\d+)/);
          const mm = mmMatch ? +mmMatch[1] : null;
          const gv = vMatch ? +vMatch[1] : g;
          if (mm === null) { if (el.endTriplet) mult = 1; continue; }
          const key = `${gv}:${mm}`;
          if (!cells.has(key)) cells.set(key, { voice: gv, measure: mm, elements: [], duration: 0, line: l });
          const cell = cells.get(key);
          cell.elements.push(el);
          cell.duration += (el.duration || 0) * mult;
          if (el.startChar >= 0) charToLoc.set(el.startChar, { voice: gv, measure: mm, el, node });
          if (mm > maxMeasure) maxMeasure = mm;
          if (el.endTriplet) mult = 1;
        }
      }
    }
  }
  const voiceCount = Math.max(voices.length, ...[...cells.values()].map((c) => c.voice + 1), 0);
  while (voices.length < voiceCount) voices.push({ index: voices.length, id: `V${voices.length + 1}`, name: `Stimme ${voices.length + 1}`, key: null, def: null, players: 1 });
  const first = cells.get("0:0");
  const hasPickup = !!(first && meter && first.duration < meter - DUR_EPS);
  return {
    voices, cells, charToLoc, meter, hasPickup, measureCount: maxMeasure + 1,
    label(mm) { return mm + (hasPickup ? 0 : 1); },
    voiceLabel(i) { const v = voices[i]; return v ? (v.name || v.id) : `Stimme ${i + 1}`; },
  };
}

// Taktdauer in ganzen Noten aus der ersten Zeile
export function meterOf(vo) {
  try {
    const m = vo.getMeterFraction ? vo.getMeterFraction() : null;
    if (m && m.num && m.den) return m.num / m.den;
  } catch (e) { /* weiter unten */ }
  const staff = vo.lines && vo.lines[0] && vo.lines[0].staff && vo.lines[0].staff[0];
  const meter = staff && staff.meter;
  if (!meter) return 1;
  if (meter.type === "common_time") return 1;
  if (meter.type === "cut_time") return 1;
  const v = meter.value && meter.value[0];
  if (v) return (parseInt(v.num, 10) || 4) / (parseInt(v.den, 10) || 4);
  return 1;
}

// Ausschnitt einer Stimme für einen Taktbereich als ABC-Text
export function excerpt(model, abc, voiceIdx, from, to) {
  const segments = [];
  let current = null;
  for (let mm = from; mm <= to; mm++) {
    const cell = model.cells.get(`${voiceIdx}:${mm}`);
    if (!cell) continue;
    const s = Math.min(...cell.elements.map((e) => e.startChar).filter((x) => x >= 0));
    const e = Math.max(...cell.elements.map((x) => x.endChar).filter((x) => x >= 0));
    if (!isFinite(s) || !isFinite(e)) continue;
    if (current && current.line === cell.line) current.end = e;
    else { current = { line: cell.line, start: s, end: e }; segments.push(current); }
  }
  return segments.map((seg) => abc.slice(seg.start, seg.end).trim()).join(" | ");
}

// Fortsetzung anhängen: Schlussstriche werden zu einfachen Taktstrichen
export function appendContinuation(abc, cont) {
  let body = (cont || "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() && !/^(X|T|C|M|L|Q|K):/.test(l) && !/^%%(score|staves)/.test(l) && !/^V:/.test(l)).join("\n");
  const base = abc.replace(/\|\]/g, "|").replace(/\s+$/, "");
  return base + "\n" + body + "\n";
}

// ABC mit fortlaufender Nummerierung „% T.“ vor jedem System, falls sie fehlt (für Prompts)
export function withBarComments(abc, model) {
  if (/^% T\./m.test(abc)) return abc;
  // Startzeichen jedes Systems aus der ersten Stimme bestimmen
  const starts = [];
  const seenLines = new Set();
  for (const cell of [...model.cells.values()].filter((c) => c.voice === 0).sort((a, b) => a.measure - b.measure)) {
    if (seenLines.has(cell.line)) continue;
    seenLines.add(cell.line);
    const sc = Math.min(...cell.elements.map((e) => e.startChar).filter((x) => x >= 0));
    if (isFinite(sc)) starts.push({ char: sc, measure: cell.measure });
  }
  let out = abc;
  for (const st of starts.sort((a, b) => b.char - a.char)) {
    const lineStart = out.lastIndexOf("\n", st.char - 1) + 1;
    out = out.slice(0, lineStart) + `% T. ${model.label(st.measure)}\n` + out.slice(lineStart);
  }
  return out;
}

export function titleOf(abc) {
  const m = abc.match(/^T:(.*)$/m);
  return m ? m[1].trim() : "Ohne Titel";
}

export function fileSafe(name) {
  return (name || "kapellmeister").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "kapellmeister";
}
