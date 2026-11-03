// Spielbarkeits- und Notationsprüfung: Tonumfang, Mehrstimmigkeit, Taktdauer, Atem, Pauken, Parallelen.
import { midiName } from "./instruments.js";

const EPS = 1e-4;

export function checkScore(vo, model, opts = {}) {
  const issues = [];
  const seen = new Set();
  const add = (x) => {
    const key = `${x.code}:${x.voice}:${x.measure}`;
    if (seen.has(key)) return;
    seen.add(key);
    x.where = x.voice >= 0 ? `${model.voiceLabel(x.voice)}, T. ${model.label(x.measure)}` : "Notation";
    issues.push(x);
  };

  // 1. Notationsfehler, die abcjs meldet
  for (const w of vo.warnings || []) {
    const text = String(w).replace(/<[^>]*>/g, "").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/\s+/g, " ").slice(0, 160);
    add({ severity: "error", code: "notation:" + text.slice(0, 40), voice: -1, measure: 0, message: `Notation: ${text}` });
  }

  // 2. Taktdauer und Taktanzahl pro Stimme
  const meter = model.meter;
  const den = meterDen(vo);
  const unitName = { 2: "Halbe", 4: "Viertel", 8: "Achtel", 16: "Sechzehntel" }[den] || "Schläge";
  const counts = model.voices.map((v, i) => countMeasures(model, i));
  const maxCount = Math.max(0, ...counts);
  const pickup = model.hasPickup ? (model.cells.get("0:0") || {}).duration || 0 : 0;
  model.voices.forEach((v, i) => {
    if (counts[i] === 0) return;
    if (counts[i] < maxCount) {
      add({ severity: "error", code: "measures", voice: i, measure: counts[i] - 1, message: `Stimme hat nur ${counts[i]} Takte, andere Stimmen ${maxCount}.` });
    }
    for (let mm = 0; mm < counts[i]; mm++) {
      const cell = model.cells.get(`${i}:${mm}`);
      const dur = cell ? cell.duration : 0;
      let expected = meter;
      if (model.hasPickup && mm === 0) expected = pickup;
      const isLast = mm === counts[i] - 1;
      if (Math.abs(dur - expected) < EPS) continue;
      if (isLast && model.hasPickup && Math.abs(dur - (meter - pickup)) < EPS) continue;
      if (dur < EPS) continue; // leere Zelle (z. B. Wiederholungsklammer)
      const have = fmt(dur * den);
      const want = fmt(expected * den);
      add({ severity: "error", code: "duration", voice: i, measure: mm, startChar: firstChar(cell), message: `Takt hat ${have} statt ${want} ${unitName}.` });
    }
  });

  // 3. Prüfungen auf Basis der Wiedergabedaten (klingende Tonhöhen)
  let audio = null;
  try { audio = vo.setUpAudio({ chordsOff: true }); } catch (e) { audio = null; }
  const tracks = audio ? audio.tracks.map((t) => t.filter((ev) => ev.cmd === "note")) : [];
  const secPerWhole = secondsPerWhole(vo);
  const mono = []; // für die Parallelenprüfung
  // Fermaten in irgendeiner Stimme gelten als Atemstelle für alle (Choral)
  const fermataStarts = new Set();
  tracks.forEach((events) => events.forEach((ev) => {
    const loc = ev.startChar !== undefined ? model.charToLoc.get(ev.startChar) : null;
    if (loc && loc.el && (loc.el.decoration || []).includes("fermata")) fermataStarts.add(Math.round(ev.start / EPS));
  }));

  tracks.forEach((events, i) => {
    const v = model.voices[i];
    if (!v || !v.def) return;
    const def = v.def;
    const players = v.players || 1;
    let lastLoc = { measure: 0 };
    const withLoc = events.map((ev) => {
      const loc = ev.startChar !== undefined ? model.charToLoc.get(ev.startChar) : null;
      if (loc) lastLoc = loc;
      return { ...ev, measure: (loc || lastLoc).measure, el: loc ? loc.el : null };
    });

    // Tonumfang: Katalog ist notiert im Standardschlüssel des Instruments; umrechnen auf den tatsächlichen Schlüssel
    const vshift = clefOctave(v.clef);
    const conv = (def.shift || 0) - vshift;
    const [lo, hi] = def.range.map((x) => x + conv);
    const [clo, chi] = def.comfort.map((x) => x + conv);
    for (const ev of withLoc) {
      const written = ev.pitch - vshift;
      if (written < lo || written > hi) {
        add({ severity: "error", code: "range", voice: i, measure: ev.measure, startChar: ev.startChar,
          message: `${noteText(written)} liegt außerhalb des Tonumfangs (${midiName(lo)}–${midiName(hi)} notiert).` });
      } else if (written < clo || written > chi) {
        add({ severity: "warn", code: "comfort", voice: i, measure: ev.measure, startChar: ev.startChar,
          message: `${noteText(written)} ist eine extreme Lage, schwer sauber zu spielen.` });
      }
    }

    // Mehrstimmigkeit
    const byStart = new Map();
    for (const ev of withLoc) {
      const k = Math.round(ev.start / EPS);
      if (!byStart.has(k)) byStart.set(k, []);
      byStart.get(k).push(ev);
    }
    for (const group of byStart.values()) {
      const pitches = new Set(group.map((e) => e.pitch));
      const n = pitches.size;
      const ev = group[0];
      const arpeggio = group.some((g) => g.el && (g.el.decoration || []).includes("arpeggio"));
      if (def.strings) {
        if (n > 4) add({ severity: "error", code: "poly", voice: i, measure: ev.measure, startChar: ev.startChar, message: `${n} Töne gleichzeitig sind auf einem Streichinstrument nicht spielbar.` });
        else if (n > 2 && !arpeggio) add({ severity: "warn", code: "poly", voice: i, measure: ev.measure, startChar: ev.startChar, message: `${n}-stimmiger Griff nur gebrochen (arpeggio) oder geteilt (div.) spielbar.` });
        else if (n === 2) {
          const [a, b] = [...pitches].sort((x, y) => x - y);
          if (b - a > 14) add({ severity: "warn", code: "dstop", voice: i, measure: ev.measure, startChar: ev.startChar, message: `Doppelgriff über eine Dezime hinaus (${midiName(a)}–${midiName(b)}) kaum greifbar, besser div.` });
        }
      } else if (def.group) {
        if (n > def.maxNotes) add({ severity: "error", code: "poly", voice: i, measure: ev.measure, startChar: ev.startChar, message: `${n} Töne in einer Hand sind zu viele (höchstens ${def.maxNotes}).` });
        const ps = [...pitches].sort((x, y) => x - y);
        if (ps.length > 1 && ps[ps.length - 1] - ps[0] > 16 && !arpeggio) add({ severity: "warn", code: "span", voice: i, measure: ev.measure, startChar: ev.startChar, message: `Griffweite ${midiName(ps[0])}–${midiName(ps[ps.length - 1])} ist größer als eine Dezime.` });
      } else {
        const limit = def.maxNotes === 2 && def.maxPitches ? 2 : players;
        if (n > limit) {
          const who = players > 1 ? `${players} Spieler können höchstens ${players} Töne` : `${v.def.name.replace(/ \(klingend\)/, "")} kann nur einen Ton`;
          add({ severity: "error", code: "poly", voice: i, measure: ev.measure, startChar: ev.startChar, message: `${who} gleichzeitig spielen, hier sind es ${n}.` });
        }
      }
    }

    // Pauken: Anzahl verschiedener Töne
    if (def.maxPitches) {
      const distinct = new Set(withLoc.map((e) => e.pitch % 12));
      if (distinct.size > def.maxPitches) add({ severity: "warn", code: "timp", voice: i, measure: 0, message: `Pauken mit ${distinct.size} verschiedenen Tönen: Umstimmen nötig, stilistisch meist 2.` });
    }

    // Atem: lange Strecken ohne Pause bei Bläsern und Sängern
    if (def.wind && withLoc.length) {
      const sorted = [...withLoc].sort((a, b) => a.start - b.start);
      let segStart = sorted[0].start;
      let segEnd = sorted[0].start + sorted[0].duration;
      let segMeasure = sorted[0].measure;
      const flush = (endEv) => {
        const seconds = (segEnd - segStart) * secPerWhole;
        if (seconds > 16) add({ severity: "warn", code: "breath", voice: i, measure: segMeasure, message: `${Math.round(seconds)} Sekunden ohne Atempause; Pause oder Zäsur einbauen.` });
      };
      const breathes = (ev) => fermataStarts.has(Math.round(ev.start / EPS)) || (ev.el && (ev.el.decoration || []).some((d) => d === "fermata" || d === "breath"));
      let pause = breathes(sorted[0]);
      for (let k = 1; k < sorted.length; k++) {
        const ev = sorted[k];
        if (pause || ev.start - segEnd > 1 / 16 - EPS) { flush(); segStart = ev.start; segMeasure = ev.measure; }
        segEnd = Math.max(segEnd, ev.start + ev.duration);
        pause = breathes(ev);
      }
      flush();
    }

    // einstimmige Stimmen für die Parallelenprüfung merken
    const isMono = [...byStart.values()].every((g) => new Set(g.map((e) => e.pitch)).size === 1);
    if (isMono && !def.group && !def.maxPitches) mono.push({ voice: i, events: [...withLoc].sort((a, b) => a.start - b.start) });
  });

  // 4. Satzlehre: offene Quint- und Oktavparallelen zwischen einstimmigen Stimmen
  if (opts.counterpoint !== false && mono.length >= 2 && mono.length <= 8) {
    for (let a = 0; a < mono.length; a++) {
      for (let b = a + 1; b < mono.length; b++) {
        parallels(mono[a], mono[b], add, model);
      }
    }
  }

  const order = { error: 0, warn: 1, info: 2 };
  issues.sort((x, y) => order[x.severity] - order[y.severity] || x.measure - y.measure || x.voice - y.voice);
  return issues;
}

function parallels(A, B, add, model) {
  const times = [...new Set([...A.events, ...B.events].map((e) => Math.round(e.start / EPS) * EPS))].sort((x, y) => x - y);
  const at = (evs, t) => {
    for (let k = evs.length - 1; k >= 0; k--) {
      const e = evs[k];
      if (e.start <= t + EPS) return t < e.start + e.duration - EPS ? e : null;
    }
    return null;
  };
  // alle Zeitpunkte, an denen sich etwas ändert; nur direkt aufeinanderfolgende Klänge ohne Pause vergleichen
  const all = times.map((t) => ({ t, a: at(A.events, t), b: at(B.events, t) }));
  const both = all.filter((s) => s.a && s.b);
  if (both.length < 2) return;
  const octaveShare = both.filter((s) => Math.abs(s.a.pitch - s.b.pitch) % 12 === 0).length / both.length;
  const doubling = octaveShare > 0.5;
  for (let k = 1; k < all.length; k++) {
    const p = all[k - 1];
    const q = all[k];
    if (!p.a || !p.b || !q.a || !q.b) continue;
    if (p.a === q.a || p.b === q.b) continue; // eine Stimme hält
    const da = q.a.pitch - p.a.pitch;
    const db = q.b.pitch - p.b.pitch;
    if (da === 0 || db === 0 || Math.sign(da) !== Math.sign(db)) continue;
    const i1 = Math.abs(p.a.pitch - p.b.pitch) % 12;
    const i2 = Math.abs(q.a.pitch - q.b.pitch) % 12;
    const voice = A.voice;
    const label = `${model.voiceLabel(A.voice)} und ${model.voiceLabel(B.voice)}`;
    if (i1 === 7 && i2 === 7) add({ severity: "info", code: `p5-${B.voice}`, voice, measure: q.a.measure, startChar: q.a.startChar, message: `Quintparallele zwischen ${label}.` });
    else if (i1 === 0 && i2 === 0 && !doubling && p.a.pitch !== p.b.pitch) add({ severity: "info", code: `p8-${B.voice}`, voice, measure: q.a.measure, startChar: q.a.startChar, message: `Oktavparallele zwischen ${label}.` });
  }
}

function clefOctave(clef) {
  if (/\+8$/.test(clef || "")) return 12;
  if (/-8$/.test(clef || "")) return -12;
  return 0;
}

function countMeasures(model, i) {
  let max = -1;
  for (const c of model.cells.values()) if (c.voice === i && c.measure > max) max = c.measure;
  return max + 1;
}

function firstChar(cell) {
  if (!cell) return undefined;
  const c = cell.elements.map((e) => e.startChar).filter((x) => x >= 0);
  return c.length ? Math.min(...c) : undefined;
}

function meterDen(vo) {
  try {
    const m = vo.getMeterFraction();
    if (m && m.den) return m.den;
  } catch (e) { /* Standard */ }
  return 4;
}

function secondsPerWhole(vo) {
  const t = vo.metaText && vo.metaText.tempo;
  if (t && t.bpm && t.duration && t.duration.length) {
    const beat = t.duration.reduce((s, x) => s + x, 0);
    return (60 / t.bpm) / beat;
  }
  return (60 / 100) * 4;
}

function fmt(x) {
  const r = Math.round(x * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

function noteText(m) {
  return midiName(m);
}

export function summarize(issues) {
  const c = { error: 0, warn: 0, info: 0 };
  for (const x of issues) c[x.severity]++;
  return c;
}
