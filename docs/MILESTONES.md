# LEFT — Meilensteine bis zum Launch

Stand: 2026-11-15. LEFT wird von einer Gruppen-Video-App zu einer
Einwegkamera-App für Events umgebaut (Vorbild: ONCE, aber deutlich günstiger).

## Entschieden

| Thema | Entscheidung |
|---|---|
| Medium | Nur Fotos. Keine Videoaufnahme, kein Mikrofon. |
| Foto-Limit | Host wählt die Rolle pro Event: **5, 10, 16, 24, 36 oder ∞** — gilt für jeden Gast. |
| Look | Host wählt **einen Film/Look pro Event** (ersetzt Screen 03 „Format“). Wird beim Auslösen aufs Gerät eingebrannt. |
| Entwicklung | Fotos sind bis Event-Ende für niemanden ausser dem Fotografen sichtbar; danach für alle. |
| Gäste | Kein Konto — Link/QR → Name → drin (anonyme Supabase-Session, existiert bereits). |
| Preis | **Vier Stufen, final (15.11.2026):** gratis bis 50 Gäste mit endlicher Rolle; ∞-Rolle bis 50 Gäste 10 CHF (`left_small`); bis 100 Gäste 15 CHF (`left_medium`); bis 150 Gäste 20 CHF (`left_large`); bis 200 Gäste 25 CHF (`left_unlimited`). Consumables, ein Kauf = ein Event, der Host zahlt beim Erstellen. Fair-Use-Deckel für ∞: 150 Fotos pro Gast; harte Obergrenze 200 Gäste. |
| Aufbewahrung | **6 Monate** nach Event-Ende (15.11.2026, vorher 12). Der Lösch-Job dafür existiert noch nicht (M6). |
| Event starten | Bleibt: der Host tippt „Start the Event“, erst dann gehen die Kameras auf (15.11.2026). |
| Web-Album | Vorerst keines (15.11.2026). Für den Fotobuch-Verkauf in Phase 2 wieder prüfen. |
| Datenbank | Keine Bestandsdaten → Schema wird neu aufgesetzt (ein sauberer Baseline-Migrationsstand). |
| Design | Bestehende Designsprache bleibt; neue Screens nach Apple-Design-Prinzipien (`apple-design`-Skill). |

## Offen

- **Domain:** `leftmoment.com` ist noch nicht gekauft — ohne sie sind Einladungen
  ausserhalb des Dev-Schemas tot.

## Kosten pro Event (Referenz zur Preisentscheidung)

Zum Vergleich ONCE: bis 5 Gäste gratis, 10 → 2 CHF, 25 → 4, 50 → 14, 100 → 25,
150 → 40, 200 → 60, unbegrenzt → 90 CHF; unbegrenzte Fotos +9 CHF.

**Was ein Event kostet** (Annahmen: Original mit ~3000 px langer Kante ≈ 1.8 MB
+ Thumbnail; Rollen werden im Schnitt zu ~60 % gefüllt; Cloudflare R2
≈ 0.015 $/GB·Monat ohne Egress-Kosten, Supabase Storage ≈ 0.021 $/GB·Monat plus
≈ 0.09 $/GB Egress über dem Kontingent — **Preise vor dem Launch nachprüfen**):

| Event | Fotos | Speicher | R2 pro Jahr |
|---|---|---|---|
| 10 Gäste × 24er | ~145 | 0.26 GB | ~0.05 $ |
| 30 Gäste × 24er | ~430 | 0.8 GB | ~0.15 $ |
| 100 Gäste × 36er | ~2 150 | 3.9 GB | ~0.70 $ |
| 200 Gäste × ∞ (≈100/Gast) | ~20 000 | 36 GB | ~6.50 $ |

- Speicher ist praktisch gratis; **teuer wäre nur Egress auf Supabase** (30 Gäste,
  die je das ganze Album in voller Auflösung laden ≈ 24 GB ≈ 2 $). Deshalb:
  Thumbnails im Grid und Originale über R2 (kein Egress) — beides sowieso nötig.
- Bei 10 000 Events/Jahr (Ø 1 GB) kommen ~10 TB/Jahr dazu. Mit 6 Monaten
  Aufbewahrung bleibt der Bestand bei ~5 TB gedeckelt ≈ 75 $/Monat auf R2, plus
  Supabase Pro 25 $/Monat.
- Ein Fotobuch bringt realistisch 10–20 CHF Marge. **~10–15 verkaufte Bücher pro
  Monat decken die Infrastruktur von ~800 Events pro Monat** — das entspricht
  einer Kaufquote von unter 2 % der Events.

## M0 · Video-Rückbau (erledigt)

- Gelöscht: Videokamera, Processing-Screen, Clip-Player, Budget-Balken/-Erklärer,
  Clip-Toasts, Clip-Download/-Thumbnails/-Playlist, Live Activity (Swift-Widget,
  Modul, Config-Plugin), Budget-Info-Modal, zugehörige Theme-Tokens.
- `app.json`: Mikrofon-/Audio-/Video-Berechtigungen und Widget-Extension entfernt,
  Berechtigungstexte auf Fotos umgestellt.
- Platzhalter-Routen: `(capture)/camera`, `(library)/album/[id]`.
- `CLAUDE.md`/`AGENTS.md` neu (jetzt im Repo-Root), drei Agents in `.claude/agents/`.
- Typecheck und Lint sind sauber.

## M1 · Backend-Fundament (erledigt)

- Eine Baseline-Migration ersetzt die 20 Video-Migrationen: `events` (Rolle, Look),
  `event_members` (`shots_taken`), `photos`, `purchases`.
- RPCs: `create_event`, `join_event` (harte Gästeobergrenze), `start_event`,
  `claim_shot` (Row-Lock, idempotent, nie erstattet), `end_event`,
  `develop_expired_events` (pg_cron, jede Minute).
- Reveal per RLS für Zeilen **und** Dateien, wirksam exakt ab `ends_at`.
  Uploads nur für tatsächlich beanspruchte Frames. Host kann Fotos löschen.
- Ein SKU `left_unlimited`; gratis bis 100 Gäste und 36er-Rolle. *(Überholt: seit 15.11.2026 vier Stufen, Migration `20261115010000_price_tiers.sql`.)*
- Client: Typen neu generiert, `lib/photos.ts`, `lib/storage.ts`, `lib/roll.ts`,
  `lib/tiers.ts`; Onboarding 03 = Film/Look (4 Looks), 05.1 = Gruppe + Rolle.
- **Geprüft:** per SQL gegen einen lokalen Stack (Rolle leer, Wiederholung
  idempotent, Fremde sehen vor dem Ende 0 Fotos/Dateien und danach alle,
  Kauf wird genau einmal verbraucht, Direkt-Schreibzugriffe abgelehnt).
  Typecheck und Lint sauber.
- **Nicht geprüft:** Edge Functions gegen RevenueCat; Konto-Löschung
  end-to-end. (Die Screens liefen am 15.11.2026 auf dem Gerät.)
- **Für dich:** einmal `npm run db:reset` im Root, damit dein lokaler Stack das
  neue Schema hat.

Vorläufig entschieden (bitte widersprechen, falls falsch): Looks heissen
Golden, Chrome, Faded, Mono; Events dauern höchstens 31 Tage; nach Event-Ende kann man per Link
weiterhin beitreten, um das Album zu sehen; ein belichtetes Bild wird nie
zurückerstattet.

## M2 · Kamera (gebaut, am 15.11.2026 vom Nutzer auf dem iPhone geprüft)

Die Runden unten sind die Entstehungsgeschichte; „nicht bestätigt“ in älteren
Runden ist durch den Gerätetest überholt. Was der Test nicht nachweislich
abgedeckt hat, steht am Ende des Abschnitts.


- **Look-Pipeline:** ein Skia-Shader (`lib/look-shader.ts`), vier Rezepte in
  `constants/looks.ts`. Derselbe Shader zeichnet die Karten auf 03 (über
  `assets/images/look-sample.jpg`, Unsplash-Lizenz) und brennt den Look ins JPEG.
  Ausgabe: Original mit 3000 px langer Kante + Thumbnail mit 640 px.
- **Screen 13 neu:** 3:4-Sucher, ein Auslöser (Reaktion und Haptik bei
  Touch-down, Auslösung beim Loslassen), Rollenzähler, Blitz (LED als Lampe
  während der Belichtung; Frontkamera: weisser Bildschirm), Zoom (nur echte
  Linsen des Geräts + Pinch), Front/Rück, Countdown oben rechts.
- **„Your shots“** (`(capture)/roll`, Kachel unten links): jeder sieht die
  eigenen Fotos schon vor der Entwicklung, die der anderen nicht (RLS).
  **Entschieden am 15.11.2026**, ersetzt „keine Vorschau des geschossenen Bilds“.
- **Looks** an Einwegkamera-Film der 90er/2000er angelehnt (warmer Farbfilm,
  kühlerer grünstichiger Film, gealterter Abzug, Schwarzweiss) plus Farbsäume
  der Plastiklinse.
- **Robuste Upload-Queue** (`lib/upload-queue.ts`): Datei sofort im
  Dokumentverzeichnis, Eintrag in AsyncStorage; Claim → Entwickeln → Upload →
  `markPhotoUploaded`, jeder Schritt wiederholbar mit derselben Foto-ID; Neustart
  bei App-Start, Wiederverbinden und im Backoff.
- **Zustände:** Berechtigung verweigert, Rolle leer, Film entwickelt, keine
  Verbindung beim allerersten Öffnen; offline-Hinweis im Sucher.
- **Entschieden:** Auslösen geht offline. Der Zähler zeigt den letzten Serverwert
  minus unbestätigte Aufnahmen und sperrt bei 0. Bilder, die bei Event-Ende noch
  nicht bestätigt sind, lehnt der Server ab – sie gehen verloren.
- **Sucher zeigt den Film exakt (15.11.2026):** Kamera von `expo-camera` auf
  `react-native-vision-camera` 5 umgestellt (`SkiaCamera`); derselbe Shader wie
  im JPEG läuft über jedes Live-Bild, Mono ist im Sucher schwarzweiss.
  `expo-camera` bleibt nur für den QR-Scanner (08). Blend-Ebenen
  (`mixBlendMode`) verdecken auf iOS das Kamerabild – nicht wieder versuchen.
- **`react-native-worklets` 0.8.3** statt Expos 0.5.1 (VisionCamera braucht es),
  von `expo install` ausgenommen. Erster EAS-Build scheiterte mit 0.7.4 an
  `'React/RCTMessageThread.h' file not found`; behoben durch 0.8.3 plus
  `plugins/with-worklets-headers.js`. (Überholt durch SDK 58: Worklets 0.13.)
- **Zoom:** Stopps aus den Linsenwechselpunkten des Geräts, beschriftet relativ
  zur Weitwinkellinse (zeigt den echten Tele-Faktor).
- **Blitz:** jetzt der echte Kamerablitz (`flashMode: 'on'`); Frontkamera:
  weisser Bildschirm.
- **Auflösung:** Fotos in 4:3 bis 3024×4032.
- **Build läuft, Kamera öffnet (15.11.2026).** Zoom-Stopps auf dem Gerät: 0.5×, 1×, 5×.
- **Absturz nach einiger Zeit im Sucher:** vermutlich Speicher (zu grosse
  Vorschau-Frames, jeder wird kopiert). Gegenmassnahme: kleinere Frames, 30 fps.
  (Ursache war eine andere, siehe Runde 7.)
- **Looks neu abgestimmt:** nur noch Farbschema (gedämpft, sauber), kein Korn im
  Sucher, kaum Korn/Vignette im Foto. Entschieden nach Referenzbildern des Nutzers.
- **Runde 6 (15.11.2026):** Frontkamera stand auf dem Kopf → Frames werden nativ
  gedreht. Vorschaubilder zeigten kurz das ungefilterte Foto → Queue entwickelt
  jetzt zuerst (dann Claim, dann Upload) und zeigt nur entwickelte Bilder.
  Blitz: LED wird vor der Aufnahme als Lampe eingeschaltet, zusätzlich zum
  Kamerablitz. Absturz: Frame-Worklet kann keine Exception mehr nach aussen
  werfen, React Compiler für `camera.tsx` aus. (Absturzursache: Runde 7.)
- **Runde 7 (15.11.2026) – Absturzursache gefunden:** Der Absturzbericht zeigt
  `EXC_BREAKPOINT` auf der Kamera-Queue in Skias GPU-Cache
  (`makeNonTextureImage` in `SkiaCamera`). RN Skia hat einen GPU-Kontext pro
  Thread, die Kamera-Queue wechselt den Thread. Speicher und Exceptions (Runden
  5/6) waren es nicht. `SkiaCamera` ist ersetzt durch
  `components/ui/film-camera.tsx`: der Kamera-Thread kopiert nur noch Pixel
  (CPU), gezeichnet wird mit dem Look-Shader im normalen `<Canvas>`.
  Auslöser nach Kamerawechsel: Freigabe hing an `onStarted`, das beim Wechsel
  nicht erneut feuert → jetzt `onConfigured` + laufende Session. Blitz: LED als
  Lampe mit Rückmeldung, Kamerablitz nur als Ersatz; `[camera] fire` /
  `[camera] torch` loggen jeden Schritt. Fotos folgen jetzt der Gerätelage
  (quer gehalten = Querformat).
- **Letztes Foto** als Kachel unten links (`lib/my-shots.ts`), Tipp öffnet „Your shots“.
- **Follow-up:** `GrainOverlay` kachelt auf grossen Flächen nicht (auch Landing).
- **03:** Beide Kartenreihen passen ohne Scrollen auf ein iPhone 16.
- **Geprüft:** Typecheck und Lint sauber; `claim_shot` lehnt bei nicht
  gestartetem Event mit `event_closed` ab (gegen den lokalen Stack).
- **Auf dem Gerät geprüft (Nutzer, 15.11.2026):** Build auf SDK 58, Kamera,
  Live-Look im Sucher, Auslösen, „Your shots“, Upload — laut Nutzer hat alles
  funktioniert.
- **Vom Test nicht nachweislich abgedeckt (gezielt nachprüfen):**
  Speicheranzeige über 1–2 Minuten im Sucher (muss flach bleiben); ob der
  Blitz die LED wirklich zündet (Logs `[camera] fire` / `[camera] torch`);
  Querformat-Foto; Verhalten nach App-Kill und im Funkloch; Android insgesamt.
- **Offen:** Look-Rezepte an echten Partyfotos abstimmen; Beispielbild evtl.
  ersetzen; `developPhoto()` blockiert den JS-Thread kurz (bei Serienaufnahmen
  ggf. in eine Worklet-Runtime verlegen).

## Upgrade auf Expo SDK 58 (15.11.2026, auf dem Gerät geprüft)

- Auf Wunsch von SDK 54 direkt auf **SDK 58**: RN 0.88, React 19.3, TypeScript 6,
  Reanimated 4.7, Worklets 0.13 (Pin auf 0.8.3 entfernt), Gesture Handler 3,
  Skia 2.14, expo-router 58 (ohne React Navigation). Neu: `expo-glass-effect`.
- Angepasst: Router-Importe, asynchrone Datei-Operationen in der Upload-Queue,
  neue `expo-media-library`-API (QR speichern auf 09), Ref-Typen, ESLint-Regeln
  (drei React-Compiler-Regeln aus, siehe `eslint.config.js`).
- **Geprüft:** Typecheck, Lint, `expo-doctor` (20/20), iOS-Bundle-Export.
- **Auf dem Gerät geprüft (Nutzer, 15.11.2026):** nativer iOS-Build mit
  VisionCamera 5.2.4, Worklets 0.13 und RN 0.88 baut und läuft.
  `plugins/with-worklets-headers.js` bleibt drin (ob es noch nötig ist, wurde
  nicht getestet). Android ist nicht gebaut.

## M3 · Entwickeln & Album (gebaut, am 15.11.2026 auf dem Gerät geprüft)

- **Glas:** `components/ui/glass.tsx` — Liquid Glass (iOS 26+), sonst Blur, bei
  „Transparenz reduzieren" deckend. `GlassButton` reagiert beim Antippen.
- **Viewer:** `components/ui/photo-viewer.tsx`, einer für „Your shots" und das
  Album: öffnet aus der Kachel und kehrt zur Kachel des aktuellen Fotos zurück,
  Wischen, Pinch, Doppeltipp, nach unten wegziehen, Federn mit
  Geschwindigkeitsübergabe, Gummiband an den Rändern, Überblendung bei
  „Bewegung reduzieren".
- **Kamera-Kachel:** öffnet weiterhin zuerst das Grid „Your shots"; ein Foto
  öffnet daraus den Viewer (so entschieden).
- **Album** `(library)/album/[id]`: vor dem Ende Countdown, Anzahl Fotos,
  nichts sichtbar, „Film jetzt entwickeln" für den Host (mit Rückfrage);
  danach Grid, Viewer mit Fotograf, Speichern (einzeln/alle), Teilen,
  Löschen (Host oder eigenes Foto). Zustände: Laden, Fehler mit „Try again",
  leer.
- **Reveal:** „Entwicklerbad" (so entschieden) — einmal pro Film und Gerät, die
  Abzüge kommen gestaffelt aus dem Dunkel, Haptik am Anfang und am Ende.
- **Your Films:** Karussell (so entschieden) mit einem Poster pro Film und
  echtem Cover (eigenes letztes Foto, nach dem Entwickeln das erste des
  Albums), Glas-Kapseln für Status und Personen, unscharfer Hintergrund aus
  dem vorderen Film.
- **`(auth)/keep`:** erscheint, wenn ein Gast ein entwickeltes Album verlässt.
- Platzhalter-Komponente und `film-card.tsx` gelöscht.
- **Geprüft:** Typecheck, Lint, iOS-Bundle-Export.
- **Auf dem Gerät geprüft (Nutzer, 15.11.2026):** Viewer, Reveal, Karussell,
  Glas, Album — laut Nutzer hat alles funktioniert.
- **Vom Test nicht nachweislich abgedeckt:** Liquid Glass auf iOS 26 (hängt
  vom iOS des Testgeräts ab); Löschen gegen die RLS als Host und als Gast;
  Verhalten offline; „Reduce Motion“ / „Reduce Transparency“.
- **Bekannte Lücken:** Teilen geht nur auf iOS (RN-`Share` kann auf Android
  keine Datei senden); „offline" hat keinen eigenen Zustand, nur die
  Fehlermeldung; der Viewer nutzt die in Gesture Handler 3 veraltete
  Builder-API (wie die Kamera).

### Nachtrag 2026-11-15 (auf dem Gerät geprüft; offen: sehr harter Schwung am Rad auf 04)

- **Your Moments:** Bibliothek heisst „Your Moments"; jeder Moment ist ein
  Bilderstapel (vorne das Titelbild, dahinter zwei gefächerte Fotos). Nicht
  entwickelt: abgedunkelte Stockfotos mit „Sample". Am Ende des Karussells und
  im leeren Zustand: Stapel „Start your moment" mit Plus und „Join a group".
- **04 Event-Ende:** Schnellwahl-Pills, darunter eine Glas-Karte mit
  Zusammenfassung, Tagesstreifen und Zeit-Rad; keine Popover mehr.
- **Glas:** `GlassPanel` (Landing, Join, „Keep your films"), runde Glas-Buttons,
  Zoom-Auswahl, Toast und der Schliessen-Button der Kamera nutzen jetzt `Glass`.
  Der Rest der Liste unten ist seit dem 15.11.2026 ebenfalls umgesetzt.
- **CI:** iOS-Dev-Build über GitHub Actions (`.github/workflows/ios-dev-build.yml`,
  Tag `ios-build-*`), ohne EAS-Kontingent.

### Glas & Bewegung in den übrigen Screens (umgesetzt 15.11.2026, auf dem Gerät nicht geprüft)

Vom Nutzer komplett freigegeben. Nur JS — **kein neuer nativer Build nötig**.

- [x] **13 Kamera:** Blitz, Zähler und Kamerawechsel schweben als `Glass` am
  oberen Rand des Suchers, „Your shots“, Zoom-Leiste und Einladung am unteren.
  **Layout-Änderung:** die Leiste unter dem Sucher entfällt, ausserhalb des
  Bildes bleibt nur der Auslöser (dort wäre Glas ohne Bild dahinter). Der
  Hinweis (offline / Foto nicht gespeichert) sitzt über der unteren Reihe.
  **Offen:** ob Glas über dem Skia-Canvas sauber zeichnet, konnte nicht auf dem
  Gerät geprüft werden — das ist das Erste, was anzuschauen ist.
- [x] **`PillButton` / `CircleIconButton`:** geben beim Antippen federnd nach
  (`PressScale`, `Press`-Tokens) statt beim Loslassen abzudunkeln; ebenso
  `AuthButton`, `ShareButton` und die Kacheln auf 08. Runde Buttons haben jetzt
  44 pt Trefferfläche.
- [x] **01 Landing, 08 Join, Sheets:** `GlassPanel` zeichnet auf `Glass`; die
  `glass`-Variante von `PillButton` ist jetzt eine flache Füllung (ihr eigener
  Blur war Glas auf Glas bzw. lag auf einem deckenden Sheet). 08 und das
  Konto-löschen-Sheet sind ziehbar (`SheetDrag`): folgen dem Finger, Gummiband
  nach oben, Loslassen übergibt die Geschwindigkeit; sie fahren beim Öffnen
  federnd hoch.
- [x] **18 Toast:** `Glass` und Feder (`Springs.settle`) statt fester Kurve.
- [x] **Popover (04):** entfällt — 04 hat seit dem Umbau keinen Popover mehr,
  und es gibt in der App keinen anderen.
- [x] **10 Gruppe:** Chips von Gästen, die beitreten, während der Host
  zuschaut, federn herein; wer beim Öffnen schon da war, ist einfach da.
  **09 hat keine Chips** (nur QR und Link) — dort gibt es nichts zu animieren.
  Die QR-Karte bleibt deckend.
- [x] **20 Einstellungen, 11/12, Onboarding:** kein Glas, nur die Press-Feder.
- **„Bewegung reduzieren“:** Toast und Chips blenden über statt zu fahren bzw.
  zu wachsen; Sheets fahren nicht, die Route blendet.
- **Nicht umgesetzt / bewusst gelassen:** der Schliessen-Button im Kopf der
  Kamera und in ihren Zustands-Screens ist weiterhin `glass`, obwohl dort kein
  Bild dahinter liegt (vom Nutzer so getestet; in M6 entscheiden).
- **Geprüft:** Typecheck und Lint sauber. **Nicht geprüft:** alles Sichtbare
  dieser Runde.

## M4 · Benachrichtigungen

- Push (`expo-notifications`): „Eure Fotos sind entwickelt“, Erinnerung kurz vor Ende.
- Die zwei Schalter in den Einstellungen bekommen Wirkung; Texte anpassen.

## M5 · Web & Einladungen

Stand 2026-11-15: **gebaut in `web/`, nicht deployt** (Domain fehlt). Astro,
statisch, für Cloudflare Pages; nur Englisch. Details und Befehle:
`web/README.md`.

**Fertig (lokal gebaut und im Browser geprüft, Desktop und Mobile):**

- `/` Home (Hero, So funktioniert es, Looks, Album, Anlässe, Preise, FAQ),
  `/use-cases/` (Hochzeit zuerst, dann Party, Reise, Geburtstag, weitere) und
  `/wedding/` als eigene Hochzeitsseite; alle gegenseitig verlinkt.
- App-Mocks als HTML/CSS aus den Design-Tokens (Kamera mit „17 left“,
  Look-Auswahl, Your Moments, Album, Beitritt, Entwickeln) — keine Screenshots.
- 11 Stockfotos von Unsplash plus die 6 Samples der App; Quelle und Lizenz in
  `web/CREDITS.md`.
- SEO: eigene Titles/Descriptions, Canonicals, Open Graph/Twitter-Karten,
  JSON-LD (`SoftwareApplication`, `FAQPage`, `BreadcrumbList`), Sitemap,
  `robots.txt`, AVIF/WebP mit Breite/Höhe und Lazy Loading. Lighthouse mobil
  (lokal): Home 92 / 100 / 100 / 100, Use cases 96 / 100 / 100 / 100, Wedding
  95 / 100 / 100 / 100 (Performance / Accessibility / Best Practices / SEO).
- `/j/{CODE}`: eine statische Seite für alle Codes (Rewrite in
  `public/_redirects`), zeigt den Code, „Open in LEFT“ (`left://j/CODE`) und
  die Store-Buttons; lokal mit `wrangler pages dev` geprüft.
- `apple-app-site-association` und `assetlinks.json` für `com.leftmoment.app`,
  Pfad `/j/*`, als JSON ausgeliefert (`public/_headers`).
- `/terms/` und `/privacy/` als Platzhalter (`noindex`, nicht in der Sitemap).

**Wartet auf die Domain:**

- Cloudflare-Pages-Projekt anlegen (Root `web`, `npm run build`, Output `dist`)
  und `leftmoment.com` aufschalten; danach die drei Prüfungen aus
  `web/README.md` (Association-Dateien erreichbar, Link öffnet die App).

**Wartet auf Store-Eintrag und Konten:**

- Store-Links in `web/src/site.ts` — bis dahin steht auf den Buttons „Coming
  soon“ und `/j/{CODE}` leitet nicht in den Store weiter (Logik ist gebaut,
  mangels Links ungetestet).
- Apple Team-ID in `apple-app-site-association`, SHA-256-Fingerprint des
  Android-Signaturschlüssels in `assetlinks.json` (beide als `REPLACE_WITH_…`
  markiert).

**Wartet auf M6:** die geprüften Rechtstexte für `/terms/` und `/privacy/`.

**Offen / nicht gebaut:**

- Der Invite-Code überlebt die Store-Installation nicht; die Seite bittet den
  Gast, den Link danach nochmals zu tippen. Ein Deferred Deep Link wäre ein
  eigener Schritt.
- Deutsch (`/de/` mit `hreflang`) — bewusst weggelassen, später ergänzbar.
- Die Fotos zeigen erkennbare Fremde (Unsplash-Lizenz, keine Model-Releases) —
  durch eigene ersetzen, sobald es echte Events gibt.
- Web-Album: vorerst nicht (entschieden 15.11.2026).

## M6 · Launch-Reife

- Rechtstexte auf Fotos umschreiben und prüfen lassen (Bilder von Personen,
  DSG/DSGVO, Aufbewahrung, Löschung); alle `[KLAMMER]`-Werte füllen.
- **Aufbewahrung 6 Monate umsetzen:** Lösch-Job (Zeilen + Dateien) für Events,
  die länger als 6 Monate entwickelt sind — existiert noch nicht; die
  Rechtstexte nennen die Frist bereits.
- Supabase-Produktion: anonyme Anmeldung + CAPTCHA + Rate-Limit, `pg_cron`,
  Storage/R2, Backups.
- Google-iOS-URL-Scheme prüfen, Apple Sign-in, EAS-Builds iOS/Android.
- Crash-Reporting/Analytics (Events erstellt, Beitritte, Fotos, Reveal-Rate).
- Store-Einträge, Screenshots, Datenschutz-Angaben; ungenutzte Abhängigkeiten
  und Theme-Tokens entfernen; `left-bg.mp4` neu encodieren.
- **TestFlight-Beta an einer echten Party** (20+ Gäste, schlechtes WLAN) — erst
  danach einreichen.

## Phase 2 (nach Launch)

- Automatisch gelayoutete Fotobücher aus dem Album; Retro-Abzüge/Boxen.
- Print-on-Demand-API (z. B. Gelato, Prodigi, CEWE) + Web-Checkout (Stripe).
- Voraussetzungen, die M1–M3 bereits schaffen: druckfähige Originale, Metadaten
  pro Foto, stabile IDs, Aufbewahrungsregel, Storage-Naht, Web-Album als Verkaufsfläche.
