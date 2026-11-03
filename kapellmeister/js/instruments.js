// Instrumentenkatalog: Tonumfang (notiert, MIDI-Nummern), Mehrstimmigkeit, Schlüssel, General-MIDI-Klang.
// Die Partitur ist klingend notiert („Partitur in C“). Ausnahmen sind nur die Oktav-Schlüssel:
// Piccolo (treble+8, klingt eine Oktave höher), Kontrabass (bass-8) und Tenor (treble-8, klingen tiefer).

export const FAMILIES = {
  holz: "Holzbläser",
  blech: "Blechbläser",
  schlag: "Pauken",
  tasten: "Tasten und Harfe",
  stimmen: "Stimmen",
  streicher: "Streicher",
};

// range: absoluter Umfang (notiert), comfort: gut klingende Lage. maxNotes: Töne gleichzeitig pro Spieler.
export const INSTRUMENTS = {
  Picc: { name: "Piccoloflöte", snm: "Picc.", family: "holz", clef: "treble+8", program: 72, shift: 12, range: [62, 96], comfort: [62, 93], maxNotes: 1, wind: true },
  Fl: { name: "Flöte", plural: "Flöten", snm: "Fl.", family: "holz", clef: "treble", program: 73, shift: 0, range: [60, 96], comfort: [60, 93], maxNotes: 1, wind: true },
  Ob: { name: "Oboe", plural: "Oboen", snm: "Ob.", family: "holz", clef: "treble", program: 68, shift: 0, range: [58, 93], comfort: [58, 88], maxNotes: 1, wind: true },
  EH: { name: "Englischhorn (klingend)", snm: "E.H.", family: "holz", clef: "treble", program: 69, shift: 0, range: [52, 84], comfort: [52, 79], maxNotes: 1, wind: true },
  Kl: { name: "Klarinette (klingend)", plural: "Klarinetten (klingend)", snm: "Kl.", family: "holz", clef: "treble", program: 71, shift: 0, range: [50, 94], comfort: [50, 89], maxNotes: 1, wind: true },
  Fg: { name: "Fagott", plural: "Fagotte", snm: "Fg.", family: "holz", clef: "bass", program: 70, shift: 0, range: [34, 75], comfort: [34, 70], maxNotes: 1, wind: true },
  Hr: { name: "Horn (klingend)", plural: "Hörner (klingend)", snm: "Hr.", family: "blech", clef: "treble", program: 60, shift: 0, range: [35, 77], comfort: [41, 72], maxNotes: 1, wind: true },
  Trp: { name: "Trompete (klingend)", plural: "Trompeten (klingend)", snm: "Trp.", family: "blech", clef: "treble", program: 56, shift: 0, range: [54, 86], comfort: [58, 81], maxNotes: 1, wind: true },
  Pos: { name: "Posaune", plural: "Posaunen", snm: "Pos.", family: "blech", clef: "bass", program: 57, shift: 0, range: [40, 77], comfort: [40, 72], maxNotes: 1, wind: true },
  Tb: { name: "Tuba", snm: "Tb.", family: "blech", clef: "bass", program: 58, shift: 0, range: [26, 65], comfort: [28, 58], maxNotes: 1, wind: true },
  Pk: { name: "Pauken", snm: "Pk.", family: "schlag", clef: "bass", program: 47, shift: 0, range: [36, 57], comfort: [38, 55], maxNotes: 2, maxPitches: 4 },
  HfR: { name: "Harfe", snm: "Hf.", family: "tasten", clef: "treble", program: 46, shift: 0, range: [23, 104], comfort: [28, 98], maxNotes: 4, group: "Hf" },
  HfL: { name: "", snm: "", family: "tasten", clef: "bass", program: 46, shift: 0, range: [23, 104], comfort: [28, 98], maxNotes: 4, group: "Hf" },
  CembR: { name: "Cembalo", snm: "Cemb.", family: "tasten", clef: "treble", program: 6, shift: 0, range: [29, 89], comfort: [29, 89], maxNotes: 5, group: "Cemb" },
  CembL: { name: "", snm: "", family: "tasten", clef: "bass", program: 6, shift: 0, range: [29, 89], comfort: [29, 89], maxNotes: 5, group: "Cemb" },
  OrgR: { name: "Orgel", snm: "Org.", family: "tasten", clef: "treble", program: 19, shift: 0, range: [36, 96], comfort: [36, 96], maxNotes: 5, group: "Org" },
  OrgL: { name: "", snm: "", family: "tasten", clef: "bass", program: 19, shift: 0, range: [36, 96], comfort: [36, 96], maxNotes: 5, group: "Org" },
  KlavR: { name: "Klavier", snm: "Klav.", family: "tasten", clef: "treble", program: 0, shift: 0, range: [21, 108], comfort: [21, 108], maxNotes: 5, group: "Klav" },
  KlavL: { name: "", snm: "", family: "tasten", clef: "bass", program: 0, shift: 0, range: [21, 108], comfort: [21, 108], maxNotes: 5, group: "Klav" },
  S: { name: "Sopran", snm: "S.", family: "stimmen", clef: "treble", program: 52, shift: 0, range: [60, 81], comfort: [62, 79], maxNotes: 1, wind: true },
  A: { name: "Alt", snm: "A.", family: "stimmen", clef: "treble", program: 52, shift: 0, range: [53, 74], comfort: [54, 72], maxNotes: 1, wind: true },
  T: { name: "Tenor", snm: "T.", family: "stimmen", clef: "treble-8", program: 52, shift: -12, range: [60, 81], comfort: [62, 79], maxNotes: 1, wind: true },
  B: { name: "Bass", snm: "B.", family: "stimmen", clef: "bass", program: 52, shift: 0, range: [40, 64], comfort: [41, 62], maxNotes: 1, wind: true },
  Vl: { name: "Violine", snm: "Vl.", family: "streicher", clef: "treble", program: 40, shift: 0, range: [55, 105], comfort: [55, 96], maxNotes: 2, strings: true },
  Vl1: { name: "Violine I", snm: "Vl. I", family: "streicher", clef: "treble", program: 40, shift: 0, range: [55, 105], comfort: [55, 96], maxNotes: 2, strings: true },
  Vl2: { name: "Violine II", snm: "Vl. II", family: "streicher", clef: "treble", program: 40, shift: 0, range: [55, 105], comfort: [55, 93], maxNotes: 2, strings: true },
  Va: { name: "Viola", snm: "Va.", family: "streicher", clef: "alto", program: 41, shift: 0, range: [48, 88], comfort: [48, 81], maxNotes: 2, strings: true },
  Vc: { name: "Violoncello", snm: "Vc.", family: "streicher", clef: "bass", program: 42, shift: 0, range: [36, 81], comfort: [36, 74], maxNotes: 2, strings: true },
  Kb: { name: "Kontrabass", snm: "Kb.", family: "streicher", clef: "bass-8", program: 43, shift: -12, range: [40, 67], comfort: [40, 62], maxNotes: 2, strings: true },
};

// Reihenfolge in der Partitur (Orchesterpartitur von oben nach unten)
export const SCORE_ORDER = ["Picc", "Fl", "Ob", "EH", "Kl", "Fg", "Hr", "Trp", "Pos", "Tb", "Pk", "HfR", "HfL",
  "CembR", "CembL", "OrgR", "OrgL", "KlavR", "KlavL", "S", "A", "T", "B", "Vl", "Vl1", "Vl2", "Va", "Vc", "Kb"];

// Besetzungen. Ein Eintrag ist [Instrument, Spieler auf diesem System].
export const ENSEMBLES = {
  klavier: { label: "Klavier solo", parts: [["KlavR", 1], ["KlavL", 1]] },
  cembalo: { label: "Cembalo solo", parts: [["CembR", 1], ["CembL", 1]] },
  orgel: { label: "Orgel (manualiter)", parts: [["OrgR", 1], ["OrgL", 1]] },
  chor: { label: "Vierstimmiger Chor (SATB)", parts: [["S", 1], ["A", 1], ["T", 1], ["B", 1]] },
  violineklavier: { label: "Violine und Klavier", parts: [["Vl", 1], ["KlavR", 1], ["KlavL", 1]] },
  klaviertrio: { label: "Klaviertrio", parts: [["Vl", 1], ["Vc", 1], ["KlavR", 1], ["KlavL", 1]] },
  streichquartett: { label: "Streichquartett", parts: [["Vl1", 1], ["Vl2", 1], ["Va", 1], ["Vc", 1]] },
  holzblaeserquintett: { label: "Holzbläserquintett", parts: [["Fl", 1], ["Ob", 1], ["Kl", 1], ["Hr", 1], ["Fg", 1]] },
  streichorchester: { label: "Streichorchester", parts: [["Vl1", 1], ["Vl2", 1], ["Va", 1], ["Vc", 1], ["Kb", 1]] },
  barockorchester: { label: "Barockorchester mit Continuo", parts: [["Fl", 1], ["Ob", 2], ["Fg", 1], ["Trp", 1], ["Pk", 1], ["Vl1", 1], ["Vl2", 1], ["Va", 1], ["Vc", 1], ["CembR", 1], ["CembL", 1]] },
  klassisch: { label: "Klassisches Orchester (Mozart, Beethoven)", parts: [["Fl", 2], ["Ob", 2], ["Kl", 2], ["Fg", 2], ["Hr", 2], ["Trp", 2], ["Pk", 1], ["Vl1", 1], ["Vl2", 1], ["Va", 1], ["Vc", 1], ["Kb", 1]] },
  romantisch: { label: "Romantisches Orchester (groß)", parts: [["Picc", 1], ["Fl", 2], ["Ob", 2], ["Kl", 2], ["Fg", 2], ["Hr", 2], ["Hr", 2], ["Trp", 2], ["Pos", 2], ["Pos", 1], ["Tb", 1], ["Pk", 1], ["HfR", 1], ["HfL", 1], ["Vl1", 1], ["Vl2", 1], ["Va", 1], ["Vc", 1], ["Kb", 1]] },
};

// Instrumente, die man in der eigenen Besetzung frei wählen kann (Tasteninstrumente als Paar)
export const CUSTOM_CHOICES = [
  { key: "Picc", label: "Piccoloflöte", max: 1 },
  { key: "Fl", label: "Flöte", max: 2 },
  { key: "Ob", label: "Oboe", max: 2 },
  { key: "EH", label: "Englischhorn", max: 1 },
  { key: "Kl", label: "Klarinette", max: 2 },
  { key: "Fg", label: "Fagott", max: 2 },
  { key: "Hr", label: "Horn", max: 2 },
  { key: "Trp", label: "Trompete", max: 2 },
  { key: "Pos", label: "Posaune", max: 2 },
  { key: "Tb", label: "Tuba", max: 1 },
  { key: "Pk", label: "Pauken", max: 1 },
  { key: "Hf", label: "Harfe", max: 1, pair: ["HfR", "HfL"] },
  { key: "Cemb", label: "Cembalo", max: 1, pair: ["CembR", "CembL"] },
  { key: "Org", label: "Orgel", max: 1, pair: ["OrgR", "OrgL"] },
  { key: "Klav", label: "Klavier", max: 1, pair: ["KlavR", "KlavL"] },
  { key: "S", label: "Sopran", max: 1 },
  { key: "A", label: "Alt", max: 1 },
  { key: "T", label: "Tenor", max: 1 },
  { key: "B", label: "Bass", max: 1 },
  { key: "Vl1", label: "Violine I", max: 1 },
  { key: "Vl2", label: "Violine II", max: 1 },
  { key: "Va", label: "Viola", max: 1 },
  { key: "Vc", label: "Violoncello", max: 1 },
  { key: "Kb", label: "Kontrabass", max: 1 },
];

const NOTE_NAMES = ["C", "Cis", "D", "Es", "E", "F", "Fis", "G", "As", "A", "B", "H"];

export function midiName(m) {
  const octave = Math.floor(m / 12) - 1;
  return NOTE_NAMES[m % 12] + octave;
}

// MIDI-Nummer -> ABC-Schreibweise (ohne Vorzeichen-Logik, nur Stammton für Umfangsangaben)
export function midiToAbc(m) {
  const names = ["C", "^C", "D", "_E", "E", "F", "^F", "G", "_A", "A", "_B", "B"];
  const name = names[m % 12];
  const octave = Math.floor(m / 12) - 1; // MIDI 60 = C4
  const acc = /^[_^]/.test(name) ? name[0] : "";
  const letter = name.replace(/^[_^]/, "");
  if (octave >= 5) return acc + letter.toLowerCase() + "'".repeat(octave - 5);
  return acc + letter + ",".repeat(Math.max(0, 4 - octave));
}

// Baut die Stimmenliste (Systeme) für eine Besetzung
export function buildStaves(parts) {
  const totals = {};
  for (const [key] of parts) totals[key] = (totals[key] || 0) + 1;
  const used = {};
  return parts.map(([key, players]) => {
    const def = INSTRUMENTS[key];
    const first = (used[key] || 0) + 1;
    const last = first + players - 1;
    used[key] = last;
    let id = key;
    let name = def.name;
    let snm = def.snm;
    if (totals[key] > 1) {
      // z. B. 4 Hörner auf zwei Systemen: Hr12 und Hr34
      id = key + (players > 1 ? `${first}${last}` : `${first}`);
      name = players > 1 ? `${def.plural || def.name} ${first}, ${last}` : `${def.name} ${first}`;
      snm = players > 1 ? `${def.snm} ${first}.${last}` : `${def.snm} ${first}`;
    } else if (players > 1) {
      name = `2 ${def.plural || def.name}`;
      snm = `${def.snm} 1.2`;
    }
    return { id, key, players, name, snm, clef: def.clef, def };
  });
}

// %%score-Zeile mit Klammern: Familien in eckigen Klammern, Tasten/Harfe in geschweiften
export function scoreLine(staves) {
  const out = [];
  let i = 0;
  while (i < staves.length) {
    const s = staves[i];
    const g = s.def.group;
    if (g) {
      const pair = staves.slice(i).filter((x, k) => k < 2 && x.def.group === g);
      out.push("{" + pair.map((x) => x.id).join(" ") + "}");
      i += pair.length;
      continue;
    }
    const fam = s.def.family;
    const run = [];
    while (i < staves.length && staves[i].def.family === fam && !staves[i].def.group) {
      run.push(staves[i].id);
      i++;
    }
    out.push(run.length > 1 ? "[" + run.join(" ") + "]" : run[0]);
  }
  return "%%score " + out.join(" ");
}

export function voiceLines(staves) {
  return staves.map((s) => {
    const name = s.name ? ` name="${s.name}"` : ' name=""';
    const snm = s.snm ? ` snm="${s.snm}"` : ' snm=""';
    return `V:${s.id}${name}${snm} clef=${s.clef}`;
  });
}

// Instrument zu einer Stimme finden: zuerst über die ID (unsere eigenen Partituren), sonst über den Namen
const NAME_HINTS = [
  [/picc/i, "Picc"], [/fl(ö|oe|u)te|flute|flauto|^fl\b/i, "Fl"], [/englisch|english|cor anglais|corno inglese/i, "EH"],
  [/oboe|hautbois|^ob\b/i, "Ob"], [/bassklar|bass clar/i, "Kl"], [/klarinett|clarinet|clarinetto|^kl\b|^cl\b/i, "Kl"],
  [/kontrafag|contrabassoon/i, "Fg"], [/fagott|bassoon|fagotto|^fg\b|^bsn/i, "Fg"],
  [/horn|corno|cor\b|^hr\b|^hn\b/i, "Hr"], [/trompete|trumpet|tromba|^trp|^tpt/i, "Trp"],
  [/posaune|trombone|^pos\b|^tbn/i, "Pos"], [/tuba/i, "Tb"], [/pauke|timpani|timbales|^pk\b|^timp/i, "Pk"],
  [/harfe|harp|arpa/i, "HfR"], [/cembalo|harpsichord|clavecin/i, "CembR"], [/orgel|organ|organo/i, "OrgR"],
  [/klavier|piano|pianoforte/i, "KlavR"], [/sopran|soprano/i, "S"], [/\balt\b|alto(?!.*sax)|contralto/i, "A"],
  [/tenor/i, "T"], [/\bbass\b|basso|baritone|bariton/i, "B"],
  [/kontrabass|contrabass|double bass|contrebasse|^kb\b|^cb\b/i, "Kb"], [/violoncell|cello|^vc\b/i, "Vc"],
  [/viola|bratsche|alto viola|^va\b|^vla/i, "Va"], [/violin|violine|geige|violon|^vl\b|^vn/i, "Vl"],
];

export function guessInstrument(id, name) {
  if (id && INSTRUMENTS[id]) return id;
  const stripped = id ? id.replace(/\d+$/, "") : "";
  if (stripped && INSTRUMENTS[stripped]) return stripped;
  // Varianten wie Ob12, Hr34, Pos3
  const m = id && id.match(/^([A-Za-z]+?)(\d+)$/);
  if (m && INSTRUMENTS[m[1]]) return m[1];
  const text = (name || "") + " " + (id || "");
  for (const [re, key] of NAME_HINTS) if (re.test(text.trim())) return key;
  return null;
}

export function rangeText(def) {
  const [lo, hi] = def.range;
  const [clo, chi] = def.comfort;
  return `${midiToAbc(lo)} bis ${midiToAbc(hi)} (${midiName(lo)}–${midiName(hi)}), gut klingend ${midiToAbc(clo)} bis ${midiToAbc(chi)}`;
}
