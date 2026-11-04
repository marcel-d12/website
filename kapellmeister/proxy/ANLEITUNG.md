# Kapellmeister: Claude-Zugang für die Demo einrichten

Die Website ist statisch (GitHub Pages) und darf den API-Schlüssel nicht enthalten, sonst könnte ihn jeder auslesen.
Deshalb läuft jede Anfrage über einen kleinen Cloudflare Worker (`worker.js`). Er hält den Schlüssel geheim, lässt nur
Anfragen mit gültigem Demo-Code durch, erlaubt nur das Modell `claude-opus-5-5`, begrenzt die Antwortlänge und zählt
Anfragen pro Code und Tag.

Wichtig: Ein Claude-Abo (Pro/Max) lässt sich dafür nicht verwenden. Die API wird separat über die Anthropic-Konsole
abgerechnet (Guthaben im Voraus).

## 1. API-Schlüssel (Anthropic-Konsole, ca. 5 Minuten)

1. https://console.anthropic.com öffnen und anmelden.
2. **Billing**: Guthaben aufladen, für die Demo reichen 20 $.
3. **Limits**: ein Monatslimit setzen, z. B. 25 $. Das ist der eigentliche Kostenschutz.
4. **API Keys → Create Key**, Name `kapellmeister-demo`. Den Schlüssel (`sk-ant-…`) kopieren; er wird nur einmal angezeigt.

## 2. Cloudflare Worker (ca. 10 Minuten, kostenlos)

1. https://dash.cloudflare.com öffnen, kostenloses Konto anlegen.
2. **Workers & Pages → Create → Create Worker** (Vorlage „Hello World“), Name `kapellmeister`, **Deploy**.
3. **Edit code**: den gesamten Inhalt von `worker.js` aus diesem Ordner einfügen, **Deploy**.
4. **Settings → Variables and Secrets → Add**, jeweils als Typ **Secret**:
   - `ANTHROPIC_API_KEY` = der Schlüssel aus Schritt 1
   - `DEMO_CODE` = ein oder mehrere Zugangscodes, durch Komma getrennt (z. B. einer für den Professor, einer für dich)
5. Optional als normale Variable: `DAILY_LIMIT` (Standard 150 Anfragen pro Code und Tag).
6. Die Adresse des Workers kopieren, sie sieht so aus: `https://kapellmeister.<name>.workers.dev`.

## 3. App verbinden

Die Worker-Adresse in `js/config.js` bei `proxyUrl` eintragen (oder Claude schicken, dann trägt Claude sie ein).
Eingetragen seit 04.11.: `https://kapellmeister.marcel-horstmann98.workers.dev`. Für einen anderen Worker funktioniert auch ein Link mit beidem:

```
https://marcelhorstmann.com/kapellmeister/#code=DEIN-CODE&proxy=https://kapellmeister.<name>.workers.dev
```

Sobald `proxyUrl` eingetragen ist, reicht `https://marcelhorstmann.com/kapellmeister/#code=DEIN-CODE`. Der Code wird
im Browser gespeichert und aus der Adresszeile entfernt. Oben rechts steht dann „Claude verbunden · Demo-Zugang“.

## Worker aktualisieren

Ändert sich `worker.js` (z. B. 04.11.: Turbo/Fast Mode freigeschaltet), im Cloudflare-Dashboard **Edit code** öffnen,
alles durch den neuen Inhalt von
https://raw.githubusercontent.com/marcel-d12/website/main/kapellmeister/proxy/worker.js ersetzen und **Deploy** klicken.
Die Secrets bleiben erhalten.

## Benachrichtigung bei Nutzung (seit 04.11.)

Der Worker meldet, wenn jemand die Seite mit Demo-Code öffnet (höchstens alle 6 Stunden pro Code) und wenn Claude
genutzt wird (höchstens alle 15 Minuten pro Code, mit Funktion, z. B. „komponiert Choral im Stil von Bach“).

- **Discord:** eigenen Server oder Kanal anlegen → Kanal-Einstellungen → **Integrationen → Webhooks → Neuer Webhook**
  → **Webhook-URL kopieren**.
- **oder ntfy:** App „ntfy“ installieren, ein schwer zu erratendes Thema abonnieren, z. B. `kapellmeister-7f3k9q`;
  die Adresse ist dann `https://ntfy.sh/kapellmeister-7f3k9q`.

In Cloudflare unter **Variables and Secrets** eintragen:

- `PING_URL` (Secret) = die Webhook-URL bzw. ntfy-Adresse
- `PING_IGNORE` (optional) = eigene Test-Codes, die keine Meldung auslösen sollen, z. B. `marcel-test-91`

## Kosten (Schätzung, Opus 5.5: 4 $ pro Million Eingabe-, 20 $ pro Million Ausgabe-Token)

| Aktion | ungefähr |
|---|---|
| 16 Takte Klavier oder Streichquartett | 0,05–0,15 $ |
| 16 Takte klassisches Orchester | 0,20–0,40 $ |
| Überarbeiten, Korrektur | wie eine Komposition |
| Drei Fortsetzungen | 0,15–0,40 $ |
| Frage oder Vorschläge | 0,02–0,08 $ |

Eine Demo-Sitzung mit 20 Aktionen kostet etwa 3–6 $.

## Abschalten

Im Cloudflare-Dashboard den Worker deaktivieren oder das Secret `DEMO_CODE` ändern. Den API-Schlüssel kann man in der
Anthropic-Konsole jederzeit widerrufen.

## Eigener Schlüssel statt Proxy

In der App unter **Einstellungen** lässt sich auch ein eigener API-Schlüssel eintragen. Er bleibt nur im eigenen Browser
und geht direkt an Anthropic. Das ist praktisch zum Testen, aber nicht zum Weitergeben an andere.
