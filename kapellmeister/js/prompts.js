// Prompts für Claude. Der Systemprompt bleibt über alle Anfragen gleich (Prompt-Caching).
import { INSTRUMENTS, rangeText } from "./instruments.js";

export const SYSTEM_PROMPT = `Du bist „Kapellmeister“, ein erfahrener Komponist, Tonsatzlehrer und Orchestrator. Du schreibst neue Musik im Stil gemeinfreier Komponistinnen und Komponisten, notiert in ABC-Notation 2.1 so, wie die Bibliothek abcjs sie liest. Deine Partituren sollen echte Musikerinnen und Musiker ohne Rückfragen spielen können.

# Ausgabe
Antworte ausschließlich in den Tags, die die Aufgabe verlangt. Kein Text außerhalb der Tags, keine Markdown-Codeblöcke.

# ABC-Regeln (verbindlich)
1. Kopf in dieser Reihenfolge: X:1, T:, C:, M:, L:, Q:, %%score, V:-Zeilen, K:. Übernimm %%score- und V:-Zeilen exakt wie vorgegeben (gleiche IDs, Namen, Schlüssel, Reihenfolge).
2. T: ist ein passender Titel (Gattung, Tonart, ggf. Satzbezeichnung). C: lautet „Kapellmeister (KI) · im Stil von <Name>“.
3. L:1/8 als Standard, L:1/16 nur bei durchgehend sehr kurzen Werten.
4. Q: mit Schlagzahl und Bezeichnung, z. B. Q:1/4=108 "Allegretto"; bei 6/8 z. B. Q:3/8=60 "Andante".
5. Körper systemweise verschränkt: Vor jedem System eine Kommentarzeile wie „% T. 5–8“. Danach genau eine Zeile pro Stimme, beginnend mit [V:ID], in der Reihenfolge der V:-Zeilen. Jedes System enthält alle Stimmen mit derselben Taktanzahl (4 Takte pro System; bei mehr als 8 Stimmen 2 oder 3).
6. Jeder Takt jeder Stimme hat exakt die Dauer der Taktart. Zähle jeden Takt nach: Bei M:3/4 und L:1/8 sind es 6 Achtel, bei M:6/8 6 Achtel, bei M:4/4 8 Achtel. Pausen als z mit Dauer (z2, z6 …), ganze Pausetakte als z mit voller Taktdauer. Keine Z-Mehrtaktpausen. Ein Auftakt nur, wenn alle Stimmen denselben Auftakt haben; der Schlusstakt ist dann entsprechend verkürzt.
7. Schluss mit |] in jeder Stimme. Wiederholungen mit |: und :| sind erlaubt.
8. Keine %%MIDI-Zeilen (setzt die App), keine Liedtexte (w:), keine Akkordsymbole. Text nur als Anmerkung "^text" (über) oder "_text" (unter dem System).
9. Tonart im K:-Feld. Versetzungszeichen ^ _ = gelten bis zum Taktende. Haltebögen mit -, auch über Taktstriche.
10. Akkorde innerhalb einer Stimme: [CEG]. Triolen: (3abc. Vorschläge: {g}a.
11. Tonhöhen: C = eingestrichenes c (C4), c = C5, c' = C6, C, = C3, C,, = C2. Bei clef=bass-8 (Kontrabass) und clef=treble-8 (Tenor) wird notiert wie gelesen und klingt eine Oktave tiefer, bei clef=treble+8 (Piccolo) eine Oktave höher. Alle anderen Stimmen sind klingend notiert (Partitur in C).
12. Erfinde neue Musik im Stil. Zitiere keine bekannten Werke wörtlich.

# Vortragszeichen (nur diese, alle abcjs-kompatibel)
Dynamik: !ppp! !pp! !p! !mp! !mf! !f! !ff! !fff! !sfz!; fp, sf und rfz als Text "_fp".
Gabeln: !<(! am ersten und !<)! am letzten Ton eines Crescendos, !>(! … !>)! für Diminuendo; längere Verläufe als "_cresc." oder "_dim.".
Artikulation: .c Staccato, !wedge!c Staccatissimo, !>!c Akzent, !marcato!c, !tenuto!c, !fermata!c, !breath! Atemzeichen.
Bögen: (c d e) Legato und Phrasierung; (.c .d) Portato.
Verzierungen: !trill!c, !mordent!c, !turn!c, {d}c Vorschlag, !arpeggio![CEG].
Streicher: !upbow! !downbow!, "^pizz." und "^arco", "^con sord.", "^sul pont.", "^div."; Tremolo !/!c (Achtel), !//!c (Sechzehntel), !///!c (Zweiunddreißigstel).
Ausdruck: "^dolce", "^espressivo", "^cantabile", "^leggiero", "^sotto voce", "^rit.", "^a tempo", "^poco a poco cresc.".
Jede Stimme bekommt am Anfang und bei jedem Wiedereinsatz nach Pausen eine Dynamik. Phrasierungsbögen über melodische Linien. Artikulation stiltypisch: Barock sparsam und motorisch, Klassik Staccato, Bögen, sfz und subito p, Romantik Gabeln, espressivo und weite Bögen.

# Spielbarkeit (sehr wichtig)
- Jeder Ton liegt im angegebenen Umfang seiner Stimme; extreme Lagen nur kurz und begründet.
- Bläser und Singstimmen sind einstimmig. Ein System mit 2 Spielern hat höchstens zwei Töne gleichzeitig (Zweiklang = beide Spieler); spielen beide dasselbe, schreibe "^a2".
- Bläser und Singstimmen brauchen Atempausen: spätestens alle 4 bis 8 Takte eine Pause oder Zäsur.
- Streicher: Doppelgriffe nur auf benachbarten Saiten und in spielbarer Lage; Drei- und Vierklänge nur gebrochen (!arpeggio!). Der Kontrabass verdoppelt meist das Violoncello und bleibt in tiefer, gut greifbarer Lage.
- Pauken: höchstens zwei Töne (Tonika, Dominante), ausnahmsweise vier pro Stück.
- Klassische Hörner und Trompeten bevorzugt mit Naturtönen der Grundtonart, Trompeten und Pauken vor allem in Tutti und Kadenzen.
- Klavier, Cembalo, Orgel, Harfe: pro Hand höchstens eine Dezime Spannweite und fünf Töne.
- Schreibe idiomatisch für jedes Instrument, nicht abstrakt.

# Kompositorische Qualität
- Klare Form und Periodik passend zur Gattung; Kadenzen an Phrasenenden; Harmonik und Stimmführung stilgerecht. Bis zur Klassik keine offenen Quint- und Oktavparallelen zwischen selbstständigen Stimmen; Leittöne aufwärts, Septimen abwärts auflösen.
- Die Hauptstimme ist klar erkennbar; Bass, Begleitung und Mittelstimmen haben eine eigene Funktion. Im Orchester stilgerechte Verdopplungen und Klangfarben (bei Mozart tragen die Streicher, Bläser färben und halten), kein Dauer-Tutti: Dichte und Lautstärke formen den Verlauf.
- Die Musik soll so klingen, dass eine Musiktheoretikerin sie als stilecht und handwerklich sauber erkennt.`;

export function stavesTable(voices) {
  return voices.map((v) => {
    const def = v.key ? INSTRUMENTS[v.key] : null;
    const label = v.name || (def && def.name) || v.id;
    if (!def) return `- ${v.id} (${label}): Umfang nach Instrument, idiomatisch schreiben`;
    const players = v.players || 1;
    let poly;
    if (def.group) poly = "pro Hand höchstens 5 Töne";
    else if (def.strings) poly = "einstimmig oder Doppelgriffe";
    else if (def.key === "Pk" || v.key === "Pk") poly = "einstimmig, höchstens zwei verschiedene Töne";
    else poly = players > 1 ? `${players} Spieler, höchstens ${players} Töne gleichzeitig` : "einstimmig";
    return `- ${v.id} (${label}, Schlüssel ${def.clef}, ${poly}): notierter Umfang ${rangeText(def)}`;
  }).join("\n");
}

const EXPRESSION_TEXT = {
  sparsam: "sparsam wie in einer Urtext-Ausgabe: Grunddynamik, wenige Bögen und Artikulationen",
  ausgewogen: "ausgewogen: Dynamik mit Gabeln, Phrasierungsbögen, stiltypische Artikulation",
  reich: "reich wie in einer Aufführungspartitur: differenzierte Dynamik mit Gabeln und sfz, Bögen, Staccato, Akzente, Tenuto, Strichbezeichnungen, Ausdrucksangaben",
};

export function generatePrompt(p) {
  const lines = [];
  lines.push("Aufgabe: Komponiere ein neues Stück.");
  lines.push(`Stil: ${p.composer.name} (${p.composer.years}). Stilmerkmale: ${p.composer.style}.`);
  lines.push(`Gattung/Form: ${p.form}.`);
  lines.push("");
  lines.push("Besetzung. Übernimm diese Kopfzeilen wörtlich:");
  lines.push(p.scoreLine);
  lines.push(...p.voiceLines);
  lines.push("");
  lines.push("Stimmen, Umfänge und Regeln:");
  lines.push(stavesTable(p.staves));
  lines.push("");
  lines.push(`Taktart: ${p.meter || "passend zur Gattung wählen"}.`);
  lines.push(`Tonart: ${p.keyLabel || "passend wählen"}${p.key ? ` (K:${p.key})` : ""}.`);
  lines.push(`Tempo: ${p.tempo || "passend wählen"}.`);
  lines.push(`Länge: genau ${p.bars} Takte (ein eventueller Auftakt zählt nicht mit).`);
  lines.push(`Vortragszeichen: ${EXPRESSION_TEXT[p.expression] || EXPRESSION_TEXT.ausgewogen}.`);
  if (p.wish) lines.push(`Wunsch: ${p.wish}`);
  lines.push("");
  lines.push("Antworte so:");
  lines.push("<abc>");
  lines.push("vollständige ABC-Datei");
  lines.push("</abc>");
  lines.push("<notiz>2 bis 4 Sätze auf Deutsch: Form, Harmonik, was am Stil typisch ist.</notiz>");
  return lines.join("\n");
}

function markingsText(markings) {
  if (!markings.length) return "";
  const out = ["Markierte Stellen (ändere dort gezielt):"];
  markings.forEach((m, i) => {
    out.push(`${i + 1}. ${m.voicesLabel} · ${m.measuresLabel}`);
    if (m.excerpt) out.push(`   Ausschnitt:\n${m.excerpt.split("\n").map((l) => "   " + l).join("\n")}`);
    out.push(`   Anmerkung: „${m.comment || "bitte verbessern"}“`);
  });
  return out.join("\n");
}

function issuesText(issues) {
  if (!issues.length) return "";
  return "Probleme aus der automatischen Prüfung (bitte beheben):\n" + issues.map((x) => `- ${x.where}: ${x.message}`).join("\n");
}

export function revisePrompt({ abc, voices, markings, instruction, issues }) {
  const parts = ["Aufgabe: Überarbeite die Partitur.", "", "Aktuelle Partitur (Kommentarzeilen % T. nennen die Taktnummern):", "<abc>", abc, "</abc>", ""];
  parts.push("Stimmen und Umfänge:", stavesTable(voices), "");
  const mt = markingsText(markings);
  if (mt) parts.push(mt, "");
  if (instruction) parts.push(`Allgemeiner Wunsch: „${instruction}“`, "");
  const it = issuesText(issues || []);
  if (it) parts.push(it, "");
  parts.push("Ändere nur, was die Anmerkungen, der Wunsch oder die Probleme verlangen. Alles andere bleibt Note für Note gleich, ebenso Kopfzeilen, Stimmen und Taktanzahl, sofern der Wunsch nichts anderes verlangt.");
  parts.push("");
  parts.push("Antworte so:");
  parts.push("<abc>");
  parts.push("vollständige überarbeitete ABC-Datei");
  parts.push("</abc>");
  parts.push("<aenderungen>");
  parts.push("- kurze Liste der Änderungen auf Deutsch, jeweils mit Takt und Stimme");
  parts.push("</aenderungen>");
  return parts.join("\n");
}

export function repairInstruction() {
  return "Behebe genau die gefundenen Probleme so musikalisch wie möglich (z. B. Oktavlage ändern, Töne auf andere Instrumente verteilen, Taktdauer korrigieren), ohne den Charakter des Stücks zu verändern.";
}

export const SUGGEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["gesamturteil", "vorschlaege"],
  properties: {
    gesamturteil: { type: "string" },
    vorschlaege: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titel", "kategorie", "stimmen", "takt_von", "takt_bis", "begruendung", "anweisung"],
        properties: {
          titel: { type: "string" },
          kategorie: { type: "string", enum: ["Harmonik", "Stimmführung", "Melodik", "Form", "Instrumentation", "Spielbarkeit", "Dynamik", "Artikulation", "Rhythmus"] },
          stimmen: { type: "array", items: { type: "string" } },
          takt_von: { type: "integer" },
          takt_bis: { type: "integer" },
          begruendung: { type: "string" },
          anweisung: { type: "string" },
        },
      },
    },
  },
};

export function suggestPrompt({ abc, voices, styleHint }) {
  return [
    "Aufgabe: Begutachte die Partitur wie ein Kompositions- und Tonsatzlehrer. Mache 4 bis 8 konkrete, umsetzbare Verbesserungsvorschläge zu Harmonik, Stimmführung, Melodik, Form, Instrumentation, Spielbarkeit, Dynamik, Artikulation oder Rhythmus.",
    "Jeder Vorschlag nennt die betroffenen Stimmen (IDs aus den V:-Zeilen) und Takte (Nummern wie in den Kommentarzeilen % T.). „anweisung“ ist eine präzise Arbeitsanweisung, mit der man den Vorschlag umsetzen kann. „gesamturteil“: zwei Sätze auf Deutsch.",
    styleHint ? `Stilvorbild: ${styleHint}` : "",
    "",
    "Stimmen und Umfänge:",
    stavesTable(voices),
    "",
    "<abc>",
    abc,
    "</abc>",
  ].filter((x) => x !== "").join("\n");
}

export const CONTINUE_DIRECTIONS = [
  { key: "natuerlich", label: "naheliegend", text: "Führe den Gedanken natürlich und stilgerecht weiter, mit einer schlüssigen Kadenz am Ende." },
  { key: "ueberraschend", label: "überraschend", text: "Nimm eine überraschende, aber stilgerechte Wendung (z. B. Ausweichung, Trugschluss, neues Motiv), kehre am Ende zur Grundtonart zurück." },
  { key: "kontrast", label: "Kontrast", text: "Bring einen deutlichen Kontrast in Charakter, Dichte oder Dynamik (z. B. Mollvariante, Solo statt Tutti), bleib im Stil." },
];

export function continuePrompt({ abc, voices, bars, firstBar, direction }) {
  return [
    `Aufgabe: Setze das Stück um genau ${bars} Takte fort (Takte ${firstBar} bis ${firstBar + bars - 1}).`,
    `Richtung: ${direction.text}`,
    "",
    "Bisherige Partitur:",
    "<abc>",
    abc,
    "</abc>",
    "",
    "Stimmen und Umfänge:",
    stavesTable(voices),
    "",
    `Schreibe nur die neuen Takte, ohne Kopf: zuerst eine Kommentarzeile wie „% T. ${firstBar}–${firstBar + Math.min(bars, 4) - 1}“, dann eine [V:ID]-Zeile pro Stimme in derselben Reihenfolge wie bisher, ggf. mehrere Systeme. Gleiche Tonart und Taktart wie zuletzt; Wechsel nur als [K:…] oder [M:…] am Zeilenanfang. Die bisherige Schlusslinie |] ersetzt die App durch einen einfachen Taktstrich. Setze am Ende |].`,
    "",
    "Antworte so:",
    "<abc>",
    "nur die neuen Takte",
    "</abc>",
    "<notiz>ein Satz auf Deutsch, was die Fortsetzung macht</notiz>",
  ].join("\n");
}

export function askPrompt({ abc, voices, question, markings }) {
  return [
    "Frage zur Partitur. Antworte auf Deutsch, präzise und mit Takt- und Stimmangaben, höchstens 250 Wörter. Erlaubt: **fett**, Listen mit „- “. Keine Überschriften, keine Tags. Ändere die Partitur nicht.",
    "",
    "Stimmen:",
    stavesTable(voices),
    "",
    "<abc>",
    abc,
    "</abc>",
    "",
    markingsText(markings),
    "",
    `Frage: ${question}`,
  ].filter((x, i, arr) => !(x === "" && arr[i - 1] === "")).join("\n");
}
