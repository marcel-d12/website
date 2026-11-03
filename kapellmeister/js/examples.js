// Beispielstücke, damit die App auch ohne Claude-Zugang etwas zeigt.

export const EXAMPLES = [
  {
    id: "menuett",
    label: "Menuett in G-Dur (Streichquartett)",
    abc: `X:1
T:Menuett in G-Dur
C:Kapellmeister (KI) · im Stil von Joseph Haydn
M:3/4
L:1/8
Q:1/4=126 "Allegretto"
%%score [Vl1 Vl2 Va Vc]
V:Vl1 name="Violine I" snm="Vl. I" clef=treble
V:Vl2 name="Violine II" snm="Vl. II" clef=treble
V:Va name="Viola" snm="Va." clef=alto
V:Vc name="Violoncello" snm="Vc." clef=bass
K:G
% T. 1–4
[V:Vl1] |: !f!d2 .g2 .g2 | (gabc') d'2 | (e'd') (c'b) (ag) | (fa) d'2 z2 |
[V:Vl2] |: z2 !f!.B2 .B2 | z2 .G2 .G2 | z2 .c2 .c2 | z2 .A2 z2 |
[V:Va] |: z2 !f!.D2 .D2 | z2 .D2 .D2 | z2 .E2 .E2 | z2 .F2 z2 |
[V:Vc] |: !f!G,,2 z4 | B,,2 z4 | C,2 z4 | D,2 z4 |
% T. 5–8
[V:Vl1] !p!d2 .g2 .g2 | (gabc') d'2 | !<(!b2 a2 (g!<)!f) | !f!g4 z2 :|
[V:Vl2] z2 !p!.B2 .B2 | z2 .G2 .G2 | z2 .c2 .c2 | !f!B4 z2 :|
[V:Va] z2 !p!.D2 .D2 | z2 .D2 .D2 | z2 .A2 .A2 | !f!G4 z2 :|
[V:Vc] !p!G,,2 z4 | B,,2 z4 | D,2 z2 D,2 | !f!G,,4 z2 :|
% T. 9–12
[V:Vl1] |: !p!a2 (d'^c') .d'.a | e'2 (d'^c') (ba) | (fa) d'2 a2 | !<(!(c'b) (ag) (f!<)!e) |
[V:Vl2] |: z2 !p!.F2 .F2 | z2 .G2 .G2 | z2 .F2 .F2 | z2 .A2 .A2 |
[V:Va] |: z2 !p!.D2 .D2 | z2 .E2 .E2 | z2 .D2 .D2 | z2 .F2 .F2 |
[V:Vc] |: !p!D,2 z4 | ^C,2 z4 | D,2 z4 | D,2 z4 |
% T. 13–16
[V:Vl1] !f!d2 .g2 .g2 | (gabc') d'2 | b2 a2 (gf) | g4 z2 :|
[V:Vl2] z2 !f!.B2 .B2 | z2 .G2 .G2 | z2 .c2 .c2 | B4 z2 :|
[V:Va] z2 !f!.D2 .D2 | z2 .D2 .D2 | z2 .A2 .A2 | G4 z2 :|
[V:Vc] !f!G,,2 z4 | B,,2 z4 | D,2 z2 D,2 | G,,4 z2 :|
`,
  },
  {
    id: "sinfonia",
    label: "Sinfonia in D-Dur (klassisches Orchester)",
    abc: `X:1
T:Sinfonia in D-Dur · Allegro (Beginn)
C:Kapellmeister (KI) · im Stil von Wolfgang Amadeus Mozart
M:4/4
L:1/8
Q:1/4=132 "Allegro"
%%score [Fl Ob Kl Fg] [Hr Trp] Pk [Vl1 Vl2 Va Vc Kb]
V:Fl name="2 Flöten" snm="Fl. 1.2" clef=treble
V:Ob name="2 Oboen" snm="Ob. 1.2" clef=treble
V:Kl name="2 Klarinetten (klingend)" snm="Kl. 1.2" clef=treble
V:Fg name="2 Fagotte" snm="Fg. 1.2" clef=bass
V:Hr name="2 Hörner (klingend)" snm="Hr. 1.2" clef=treble
V:Trp name="2 Trompeten (klingend)" snm="Trp. 1.2" clef=treble
V:Pk name="Pauken" snm="Pk." clef=bass
V:Vl1 name="Violine I" snm="Vl. I" clef=treble
V:Vl2 name="Violine II" snm="Vl. II" clef=treble
V:Va name="Viola" snm="Va." clef=alto
V:Vc name="Violoncello" snm="Vc." clef=bass
V:Kb name="Kontrabass" snm="Kb." clef=bass-8
K:D
% T. 1–4
[V:Fl] !f![fa]2 z6 | [eg]2 z6 | z8 | z8 |
[V:Ob] !f![df]2 z6 | [ce]2 z6 | z8 | z8 |
[V:Kl] !f![Ad]2 z6 | [Ac]2 z6 | z8 | z8 |
[V:Fg] !f![D,A,]2 z6 | [A,,E,]2 z6 | z8 | z8 |
[V:Hr] !f![DA]2 z6 | [EA]2 z6 | !p![DA]8 | [EA]8 |
[V:Trp] !f![df]2 z6 | [Ae]2 z6 | z8 | z8 |
[V:Pk] !f!D,2 z6 | A,,2 z6 | z8 | z8 |
[V:Vl1] !f!d'2 z6 | c'2 z6 | !p!(d2 f2 a2 d'2) | (c'b) (ag) (fe) (dc) |
[V:Vl2] !f!f2 z6 | g2 z6 | !p!FFFF FFFF | GGGG GGGG |
[V:Va] !f!A2 z6 | e2 z6 | !p!DDDD DDDD | EEEE EEEE |
[V:Vc] !f!D,2 z6 | A,,2 z6 | !p!D,2 z2 D,2 z2 | A,,2 z2 A,,2 z2 |
[V:Kb] !f!D,2 z6 | A,,2 z6 | !p!D,2 z2 D,2 z2 | A,,2 z2 A,,2 z2 |
% T. 5–8
[V:Fl] z8 | z8 | !f![fa]4 [eg]4 | [fa]2 z2 [fa]2 z2 |]
[V:Ob] !p!(B2 d2 g2 b2) | (f2 a2) e4 | !f![df]4 [ce]4 | [df]2 z2 [df]2 z2 |]
[V:Kl] z8 | z8 | !f![Ad]4 [Ac]4 | [Ad]2 z2 [Ad]2 z2 |]
[V:Fg] !p!G,2 z2 G,2 z2 | D,2 z2 A,,2 z2 | !f![A,,A,]4 [A,,A,]4 | [D,A,]2 z2 [D,A,]2 z2 |]
[V:Hr] z8 | [DA]4 [EA]4 | !f![DA]4 [EA]4 | [DA]2 z2 [DA]2 z2 |]
[V:Trp] z8 | z8 | !f![Ad]4 [Ae]4 | [df]2 z2 [df]2 z2 |]
[V:Pk] z8 | z8 | !f!A,,2 A,,2 A,,2 A,,2 | D,2 z2 D,2 z2 |]
[V:Vl1] (B2 d2 g2 b2) | (!<(!f2 a2) !<)!e4 | !f!f'2 a'2 (g'e') (c'e') | d'2 z2 d'2 z2 |]
[V:Vl2] GGGG GGGG | FFFF EEEE | !f![Ad]2 [Ad]2 [Ac]2 [Ac]2 | [Ad]2 z2 [Ad]2 z2 |]
[V:Va] DDDD DDDD | DDDD CCCC | !f![FA]2 [FA]2 [EA]2 [EA]2 | [FA]2 z2 [FA]2 z2 |]
[V:Vc] G,,2 z2 G,,2 z2 | D,2 z2 A,,2 z2 | !f!A,,2 A,,2 A,,2 A,,2 | D,2 z2 D,2 z2 |]
[V:Kb] G,,2 z2 G,,2 z2 | D,2 z2 A,,2 z2 | !f!A,,2 A,,2 A,,2 A,,2 | D,2 z2 D,2 z2 |]
`,
  },
  {
    id: "pruefdemo",
    label: "Prüf-Demo: typische KI-Fehler",
    abc: `X:1
T:Prüf-Demo: typische KI-Fehler
C:absichtlich fehlerhaft, zum Ausprobieren der Spielbarkeitsprüfung
M:4/4
L:1/8
Q:1/4=96 "Andante"
%%score [Fl Ob Fg] [Vl1 Vl2 Va Vc Kb]
V:Fl name="Flöte" snm="Fl." clef=treble
V:Ob name="2 Oboen" snm="Ob. 1.2" clef=treble
V:Fg name="Fagott" snm="Fg." clef=bass
V:Vl1 name="Violine I" snm="Vl. I" clef=treble
V:Vl2 name="Violine II" snm="Vl. II" clef=treble
V:Va name="Viola" snm="Va." clef=alto
V:Vc name="Violoncello" snm="Vc." clef=bass
V:Kb name="Kontrabass" snm="Kb." clef=bass-8
K:G
% T. 1–4
[V:Fl] !mf!(d'4 g'4) | (b'4 d''4) | (c''4 b'2 g'2) | (a'4 f'4) |
[V:Ob] !mf![GBd]4 [Bd]4 | [ce]8 | [Bd]4 [GB]4 | [Ac]8 |
[V:Fg] !mf!G,,4 G,,4 | C,4 A,,,4 | G,,4 B,,4 | D,8 |
[V:Vl1] !mf![G,DBg]8 | (efga) (bagf) | (gabg) (dcBA) | (cdef) (gfed) |
[V:Vl2] !mf!B4 d4 | c4 e4 | d4 B4 | A8 |
[V:Va] !mf!G4 G4 | G4 c4 | D4 E4 | D6 |
[V:Vc] !mf!G,4 G,4 | C,4 C,4 | G,4 A,4 | D,8 |
[V:Kb] !mf!G,4 G,4 | C,4 C,4 | G,4 G,4 | D,,8 |
% T. 5–8
[V:Fl] (b'4 a'4) | (g'4 f'2 e'2) | !p!(d'4 c'4) | b8 |]
[V:Ob] !p![Bd]8 | [Ac]8 | [GB]4 [FA]4 | [GB]8 |]
[V:Fg] !p!G,,8 | A,,8 | D,4 D,,4 | G,,8 |]
[V:Vl1] (gfed) (cBAG) | (FGAB) (cdef) | g4 f4 | g8 |]
[V:Vl2] d8 | c8 | B4 A4 | B8 |]
[V:Va] G8 | E8 | D4 D4 | D8 |]
[V:Vc] G,8 | A,8 | D,4 D,4 | G,8 |]
[V:Kb] G,8 | A,8 | D,4 D,4 | G,8 |]
`,
  },
];
