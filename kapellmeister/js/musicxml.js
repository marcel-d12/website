// Export der gerenderten ABC-Partitur nach MusicXML 4.0 (partwise).
// Grundlage ist der von abcjs geparste Notentext; Tonhöhen werden mit Vorzeichen-Logik selbst bestimmt.
import { guessInstrument, INSTRUMENTS } from "./instruments.js";

const DIV = 480; // Divisions pro Viertel
const STEPS = ["C", "D", "E", "F", "G", "A", "B"];
const TYPES = [[2, "breve"], [1, "whole"], [0.5, "half"], [0.25, "quarter"], [0.125, "eighth"], [0.0625, "16th"], [0.03125, "32nd"], [0.015625, "64th"]];
const DYNAMICS = new Set(["pppp", "ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "ffff", "sfz"]);
const ACC_ALTER = { sharp: 1, flat: -1, natural: 0, dblsharp: 2, dblflat: -2, quartersharp: 0.5, quarterflat: -0.5 };
const ACC_NAME = { sharp: "sharp", flat: "flat", natural: "natural", dblsharp: "double-sharp", dblflat: "flat-flat" };

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toMusicXML(vo, model, meta = {}) {
  const lines = vo.lines || [];
  const first = lines.find((l) => l.staff) || { staff: [] };
  const staffInfo = first.staff.map((st) => ({ clef: st.clef, key: st.key, meter: st.meter, voices: st.voices.length, brace: st.brace, bracket: st.bracket, title: st.title }));

  // Stimmen global durchnummerieren und Elemente über alle Zeilen sammeln
  const voiceStaff = [];
  staffInfo.forEach((st, s) => { for (let v = 0; v < st.voices; v++) voiceStaff.push({ staff: s, inStaff: v }); });
  const streams = voiceStaff.map(() => []);
  for (const line of lines) {
    if (!line.staff) continue;
    let g = 0;
    line.staff.forEach((st) => {
      st.voices.forEach((elems) => { if (streams[g]) streams[g].push(...elems, { el_type: "__linebreak" }); g++; });
    });
  }

  // Teile (Parts): Klammer {..} -> ein Part mit mehreren Systemen
  const parts = [];
  for (let s = 0; s < staffInfo.length; s++) {
    const st = staffInfo[s];
    if (st.brace === "start") {
      const staves = [s];
      let k = s + 1;
      while (k < staffInfo.length) { staves.push(k); if (staffInfo[k].brace === "end") break; k++; }
      parts.push({ staves });
      s = k;
    } else parts.push({ staves: [s] });
  }

  const meter = meterInfo(staffInfo[0] && staffInfo[0].meter);
  const measureDiv = Math.round(meter.whole * 4 * DIV);
  const tempo = vo.metaText && vo.metaText.tempo;

  let partList = "";
  let partBodies = "";
  let groupNo = 0;
  parts.forEach((part, pi) => {
    const pid = `P${pi + 1}`;
    const firstStaff = staffInfo[part.staves[0]];
    const gIdx = voiceStaff.findIndex((x) => x.staff === part.staves[0]);
    const mv = model.voices[gIdx] || {};
    const key = mv.key || guessInstrument(mv.id, mv.name);
    const def = key ? INSTRUMENTS[key] : null;
    const name = (mv.name || (firstStaff.title && firstStaff.title[0]) || `Stimme ${pi + 1}`).replace(/ \(links\)$/, "");
    if (firstStaff.bracket === "start") { groupNo++; partList += `<part-group type="start" number="${groupNo}"><group-symbol>bracket</group-symbol><group-barline>yes</group-barline></part-group>`; }
    partList += `<score-part id="${pid}"><part-name>${esc(name)}</part-name>${mv.snm ? `<part-abbreviation>${esc(mv.snm)}</part-abbreviation>` : ""}` +
      `<score-instrument id="${pid}-I1"><instrument-name>${esc(name)}</instrument-name></score-instrument>` +
      `<midi-instrument id="${pid}-I1"><midi-channel>${(pi % 15) + 1 + (pi % 15 >= 9 ? 1 : 0)}</midi-channel><midi-program>${(def ? def.program : 0) + 1}</midi-program></midi-instrument></score-part>`;
    const lastStaff = staffInfo[part.staves[part.staves.length - 1]];
    if (lastStaff.bracket === "end" && groupNo > 0) partList += `<part-group type="stop" number="${groupNo}"/>`;

    // Takte jeder Stimme in diesem Part
    const voicesInPart = [];
    part.staves.forEach((s, si) => {
      voiceStaff.forEach((x, g) => { if (x.staff === s) voicesInPart.push({ g, staffNo: si + 1, voiceNo: si * 4 + x.inStaff + 1, clefShift: clefShift(staffInfo[s].clef) }); });
    });
    const measuresPerVoice = voicesInPart.map((v) => splitMeasures(streams[v.g]));
    const count = Math.max(1, ...measuresPerVoice.map((m) => m.length));

    let body = "";
    for (let m = 0; m < count; m++) {
      const implicit = m === 0 && model.hasPickup;
      body += `<measure number="${implicit ? 0 : model.hasPickup ? m : m + 1}"${implicit ? ' implicit="yes"' : ""}>`;
      if (m === 0) {
        body += "<attributes>";
        body += `<divisions>${DIV}</divisions>`;
        body += keyXml(firstStaff.key);
        body += timeXml(firstStaff.meter);
        if (part.staves.length > 1) body += `<staves>${part.staves.length}</staves>`;
        part.staves.forEach((s, si) => { body += clefXml(staffInfo[s].clef, part.staves.length > 1 ? si + 1 : null); });
        body += "</attributes>";
        if (pi === 0 && tempo) body += tempoXml(tempo);
      }
      let barRight = null;
      const m0 = measuresPerVoice[0] && measuresPerVoice[0][m];
      if (m0 && m0.repeatStart) body += `<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>`;
      voicesInPart.forEach((v, k) => {
        const meas = measuresPerVoice[k][m];
        const keyAcc = keyAlterMap(staffInfo[voiceStaff[v.g].staff].key);
        const { xml, duration, bar } = measureXml(meas, v, keyAcc, part.staves.length > 1, meter);
        let content = xml;
        let dur = duration;
        if (!meas || duration === 0) {
          const restDur = implicit ? 0 : measureDiv;
          if (restDur) { content = `<note><rest measure="yes"/><duration>${restDur}</duration><voice>${v.voiceNo}</voice>${part.staves.length > 1 ? `<staff>${v.staffNo}</staff>` : ""}</note>`; dur = restDur; }
        }
        body += content;
        if (bar && !barRight) barRight = bar;
        if (k < voicesInPart.length - 1 && dur > 0) body += `<backup><duration>${dur}</duration></backup>`;
      });
      if (m === count - 1 && !barRight) barRight = "bar_thin_thick";
      body += barXml(barRight);
      body += "</measure>";
    }
    partBodies += `<part id="${pid}">${body}</part>`;
  });

  const title = (vo.metaText && vo.metaText.title) || meta.title || "Kapellmeister";
  const composer = (vo.metaText && vo.metaText.composer) || "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n` +
    `<score-partwise version="4.0"><work><work-title>${esc(title)}</work-title></work>` +
    `<identification>${composer ? `<creator type="composer">${esc(composer)}</creator>` : ""}<encoding><software>Kapellmeister (marcelhorstmann.com)</software><encoding-date>${new Date().toISOString().slice(0, 10)}</encoding-date></encoding></identification>` +
    `<part-list>${partList}</part-list>${partBodies}</score-partwise>\n`;
}

function splitMeasures(stream) {
  const measures = [];
  let cur = { items: [], bar: null };
  const hasContent = (m) => m.items.some((x) => x.el_type === "note");
  for (const el of stream) {
    if (el.el_type === "bar") {
      const startsRepeat = el.type === "bar_left_repeat" || el.type === "bar_dbl_repeat";
      if (hasContent(cur)) { cur.bar = el.type; cur.barDeco = el.decoration; measures.push(cur); cur = { items: [], bar: null, repeatStart: startsRepeat }; }
      else {
        if (startsRepeat) cur.repeatStart = true;
        if (el.decoration) cur.items.push({ el_type: "__deco", decoration: el.decoration });
      }
      continue;
    }
    if (el.el_type === "note" || el.el_type === "key" || el.el_type === "meter") cur.items.push(el);
  }
  if (hasContent(cur)) measures.push(cur);
  return measures;
}

function measureXml(meas, v, keyAcc, multiStaff, meter) {
  if (!meas) return { xml: "", duration: 0, bar: null };
  let xml = "";
  let total = 0;
  const measureAcc = new Map();
  let mult = 1;
  let tupletN = 0;
  const staffTag = multiStaff ? `<staff>${v.staffNo}</staff>` : "";
  const slurNo = new Map();
  let nextSlur = 1;
  for (const el of meas.items) {
    if (el.el_type === "__deco") { xml += directionsXml(el.decoration, null, v, multiStaff); continue; }
    if (el.el_type !== "note") continue;
    if (el.startTriplet) { mult = el.tripletMultiplier || 1; tupletN = el.startTriplet; }
    xml += directionsXml(el.decoration, el.chord, v, multiStaff);
    // Vorschläge
    for (const gn of el.gracenotes || []) {
      const p = pitchXml(gn, keyAcc, measureAcc, v.clefShift);
      xml += `<note><grace slash="yes"/>${p.pitch}<voice>${v.voiceNo}</voice><type>eighth</type>${p.acc}${staffTag}</note>`;
    }
    const nominal = el.duration || 0;
    const dur = Math.round(nominal * mult * 4 * DIV);
    const { type, dots } = typeOf(nominal);
    const tm = mult !== 1 ? `<time-modification><actual-notes>${tupletN}</actual-notes><normal-notes>${Math.round(tupletN * mult)}</normal-notes></time-modification>` : "";
    const notations = [];
    if (el.startTriplet) notations.push(`<tuplet type="start" bracket="yes"/>`);
    if (el.endTriplet) notations.push(`<tuplet type="stop"/>`);
    const deco = el.decoration || [];
    const arts = [];
    if (deco.includes("staccato")) arts.push("<staccato/>");
    if (deco.includes("accent") || deco.includes(">") || deco.includes("emphasis")) arts.push("<accent/>");
    if (deco.includes("tenuto")) arts.push("<tenuto/>");
    if (deco.includes("marcato") || deco.includes("umarcato")) arts.push(`<strong-accent type="up"/>`);
    if (deco.includes("wedge")) arts.push("<staccatissimo/>");
    if (deco.includes("breath")) arts.push("<breath-mark/>");
    if (arts.length) notations.push(`<articulations>${arts.join("")}</articulations>`);
    const orn = [];
    if (deco.includes("trill")) orn.push("<trill-mark/>");
    if (deco.includes("mordent") || deco.includes("lowermordent")) orn.push("<mordent/>");
    if (deco.includes("uppermordent") || deco.includes("pralltriller")) orn.push("<inverted-mordent/>");
    if (deco.includes("turn")) orn.push("<turn/>");
    if (deco.includes("invertedturn")) orn.push("<inverted-turn/>");
    const trem = deco.find((d) => /^\/{1,3}$/.test(d));
    if (trem) orn.push(`<tremolo type="single">${trem.length}</tremolo>`);
    if (orn.length) notations.push(`<ornaments>${orn.join("")}</ornaments>`);
    const tech = [];
    if (deco.includes("upbow")) tech.push("<up-bow/>");
    if (deco.includes("downbow")) tech.push("<down-bow/>");
    if (tech.length) notations.push(`<technical>${tech.join("")}</technical>`);
    if (deco.includes("fermata")) notations.push(`<fermata type="upright"/>`);
    if (deco.includes("arpeggio")) notations.push("<arpeggiate/>");
    const typeTag = `<type>${type}</type>${"<dot/>".repeat(dots)}`;
    if (el.rest) {
      const isMeasureRest = Math.abs(nominal - meter.whole) < 1e-6;
      xml += `<note><rest${isMeasureRest ? ' measure="yes"' : ""}/><duration>${dur}</duration><voice>${v.voiceNo}</voice>${isMeasureRest ? "" : typeTag}${tm}${staffTag}${notations.length ? `<notations>${notations.join("")}</notations>` : ""}</note>`;
    } else {
      const pitches = el.pitches || [];
      // Bögen auf Noten- oder Tonhöhenebene
      const starts = [...(el.startSlur || []), ...pitches.flatMap((p) => p.startSlur || [])];
      const ends = [...(el.endSlur || []), ...pitches.flatMap((p) => p.endSlur || [])];
      pitches.forEach((p, k) => {
        const px = pitchXml(p, keyAcc, measureAcc, v.clefShift);
        const ties = [];
        const tied = [];
        if (p.endTie) { ties.push(`<tie type="stop"/>`); tied.push(`<tied type="stop"/>`); }
        if (p.startTie) { ties.push(`<tie type="start"/>`); tied.push(`<tied type="start"/>`); }
        const n = k === 0 ? [...notations] : [];
        for (const e of (k === 0 ? ends : [])) {
          const label = typeof e === "object" ? e.label : e;
          const no = slurNo.get(label) || 1;
          n.push(`<slur type="stop" number="${no}"/>`);
        }
        for (const s of (k === 0 ? starts : [])) {
          const label = typeof s === "object" ? s.label : s;
          const no = ((nextSlur++ - 1) % 6) + 1;
          slurNo.set(label, no);
          n.push(`<slur type="start" number="${no}"/>`);
        }
        n.unshift(...tied);
        xml += `<note>${k > 0 ? "<chord/>" : ""}${px.pitch}<duration>${dur}</duration>${ties.join("")}<voice>${v.voiceNo}</voice>${typeTag}${px.acc}${tm}${staffTag}${n.length ? `<notations>${n.join("")}</notations>` : ""}</note>`;
      });
    }
    total += dur;
    if (el.endTriplet) { mult = 1; tupletN = 0; }
  }
  if (meas.barDeco) xml += directionsXml(meas.barDeco, null, v, multiStaff);
  return { xml, duration: total, bar: meas.bar };
}

function pitchXml(p, keyAcc, measureAcc, shift) {
  const step = STEPS[((p.pitch % 7) + 7) % 7];
  const octave = 4 + Math.floor(p.pitch / 7);
  const id = `${step}${octave}`;
  let alter;
  let acc = "";
  if (p.accidental && ACC_ALTER[p.accidental] !== undefined) {
    alter = ACC_ALTER[p.accidental];
    measureAcc.set(id, alter);
    if (ACC_NAME[p.accidental]) acc = `<accidental>${ACC_NAME[p.accidental]}</accidental>`;
  } else if (measureAcc.has(id)) alter = measureAcc.get(id);
  else alter = keyAcc[step] || 0;
  return { pitch: `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${octave + shift}</octave></pitch>`, acc };
}

function directionsXml(deco, chord, v, multiStaff) {
  let out = "";
  const staffTag = multiStaff ? `<staff>${v.staffNo}</staff>` : "";
  const voiceTag = `<voice>${v.voiceNo}</voice>`;
  for (const d of deco || []) {
    if (DYNAMICS.has(d)) out += `<direction placement="below"><direction-type><dynamics><${d}/></dynamics></direction-type>${voiceTag}${staffTag}</direction>`;
    else if (d === "crescendo(" || d === "<(") out += `<direction placement="below"><direction-type><wedge type="crescendo"/></direction-type>${voiceTag}${staffTag}</direction>`;
    else if (d === "diminuendo(" || d === ">(") out += `<direction placement="below"><direction-type><wedge type="diminuendo"/></direction-type>${voiceTag}${staffTag}</direction>`;
    else if (d === "crescendo)" || d === "diminuendo)" || d === "<)" || d === ">)") out += `<direction placement="below"><direction-type><wedge type="stop"/></direction-type>${voiceTag}${staffTag}</direction>`;
  }
  for (const c of chord || []) {
    const placement = c.position === "below" ? "below" : "above";
    out += `<direction placement="${placement}"><direction-type><words font-style="italic">${esc(c.name)}</words></direction-type>${voiceTag}${staffTag}</direction>`;
  }
  return out;
}

function typeOf(nominal) {
  for (const [base, name] of TYPES) {
    if (Math.abs(nominal - base) < 1e-6) return { type: name, dots: 0 };
    if (Math.abs(nominal - base * 1.5) < 1e-6) return { type: name, dots: 1 };
    if (Math.abs(nominal - base * 1.75) < 1e-6) return { type: name, dots: 2 };
  }
  // nächstliegender Typ
  let best = TYPES[3];
  for (const t of TYPES) if (Math.abs(Math.log(nominal / t[0])) < Math.abs(Math.log(nominal / best[0]))) best = t;
  return { type: best[1], dots: 0 };
}

function meterInfo(meter) {
  if (!meter || meter.type === "common_time") return { whole: 1, beats: 4, beatType: 4, symbol: meter && meter.type === "common_time" ? "common" : null };
  if (meter.type === "cut_time") return { whole: 1, beats: 2, beatType: 2, symbol: "cut" };
  const v = (meter.value && meter.value[0]) || { num: 4, den: 4 };
  const num = parseInt(v.num, 10) || 4;
  const den = parseInt(v.den, 10) || 4;
  return { whole: num / den, beats: num, beatType: den, symbol: null };
}

function timeXml(meter) {
  const m = meterInfo(meter);
  return `<time${m.symbol ? ` symbol="${m.symbol}"` : ""}><beats>${m.beats}</beats><beat-type>${m.beatType}</beat-type></time>`;
}

function keyAlterMap(key) {
  const map = {};
  for (const a of (key && key.accidentals) || []) map[a.note.toUpperCase()] = ACC_ALTER[a.acc] || 0;
  return map;
}

function keyXml(key) {
  const accs = (key && key.accidentals) || [];
  const sharps = accs.filter((a) => a.acc === "sharp").length;
  const flats = accs.filter((a) => a.acc === "flat").length;
  const fifths = sharps ? sharps : -flats;
  const mode = key && /^m/i.test(key.mode || "") && !/^mix/i.test(key.mode || "") ? "minor" : "major";
  return `<key><fifths>${fifths}</fifths><mode>${mode}</mode></key>`;
}

function clefShift(clef) {
  const t = (clef && clef.type) || "treble";
  if (/\+8$/.test(t)) return 1;
  if (/-8$/.test(t)) return -1;
  return 0;
}

function clefXml(clef, number) {
  const t = (clef && clef.type) || "treble";
  const base = t.replace(/[+-]8$/, "");
  const map = { treble: ["G", 2], bass: ["F", 4], alto: ["C", 3], tenor: ["C", 4], perc: ["percussion", null] };
  const [sign, line] = map[base] || map.treble;
  const oct = clefShift(clef);
  return `<clef${number ? ` number="${number}"` : ""}><sign>${sign}</sign>${line ? `<line>${line}</line>` : ""}${oct ? `<clef-octave-change>${oct}</clef-octave-change>` : ""}</clef>`;
}

function tempoXml(t) {
  const beat = (t.duration || [0.25]).reduce((s, x) => s + x, 0);
  const unit = typeOf(beat);
  const words = t.preString || t.postString || "";
  const bpm = t.bpm || 100;
  return `<direction placement="above">${words ? `<direction-type><words font-weight="bold">${esc(words)}</words></direction-type>` : ""}<direction-type><metronome><beat-unit>${unit.type}</beat-unit>${unit.dots ? "<beat-unit-dot/>" : ""}<per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${Math.round(bpm * beat * 4)}"/></direction>`;
}

function barXml(type) {
  if (!type || type === "bar_thin") return "";
  if (type === "bar_thin_thick") return `<barline location="right"><bar-style>light-heavy</bar-style></barline>`;
  if (type === "bar_thin_thin") return `<barline location="right"><bar-style>light-light</bar-style></barline>`;
  if (type === "bar_right_repeat" || type === "bar_dbl_repeat") return `<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>`;
  return "";
}
