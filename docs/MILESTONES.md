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
| Preis | **Gratis bis 100 Gäste und 36er-Rolle. Ein einziger SKU „LEFT Unlimited“** (Richtwert 5 CHF, einmalig pro Event) schaltet die ∞-Rolle und Events bis 200 Gäste frei. |
| Datenbank | Keine Bestandsdaten → Schema wird neu aufgesetzt (ein sauberer Baseline-Migrationsstand). |
| Design | Bestehende Designsprache bleibt; neue Screens nach Apple-Design-Prinzipien (`apple-design`-Skill). |

## Offen — bitte entscheiden

### 1. Details zum SKU (Vorschlag, bitte bestätigen)

- Preis 5 CHF; Produkt-ID `left_unlimited` (Consumable, ein Kauf = ein Event).
- Fair-Use-Deckel für ∞: 150 Fotos pro Gast. Harte Obergrenze 200 Gäste.
- Aufbewahrung 12 Monate, länger sobald etwas gekauft wurde.

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
- Bei 10 000 Events/Jahr (Ø 1 GB) wächst der Speicher um ~10 TB/Jahr ≈ 150 $/Monat
  nach einem Jahr, plus Supabase Pro 25 $/Monat. Mit 12 Monaten Aufbewahrung
  bleibt das gedeckelt.
- Ein Fotobuch bringt realistisch 10–20 CHF Marge. **~10–15 verkaufte Bücher pro
  Monat decken die Infrastruktur von ~800 Events pro Monat** — das entspricht
  einer Kaufquote von unter 2 % der Events.

### 2. Weitere offene Punkte

- **„Event starten“ durch den Host behalten?** Heute: Host tippt Start, dann gehen
  alle Kameras auf. Alternative: Event ist ab Erstellung offen (weniger Reibung
  für Reisen). Empfehlung: behalten für M1, in der Beta testen.
- **Web-Album:** Sollen entwickelte Alben auch ohne App per Link ansehbar sein?
  Für den MVP nicht nötig, für Fotobuch-Verkauf in Phase 2 sehr wertvoll.
- **Domain:** `leftmoment.com` existiert noch nicht — ohne sie sind Einladungen tot.

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
- Ein SKU `left_unlimited`; gratis bis 100 Gäste und 36er-Rolle.
- Client: Typen neu generiert, `lib/photos.ts`, `lib/storage.ts`, `lib/roll.ts`,
  `lib/tiers.ts`; Onboarding 03 = Film/Look (4 Looks), 05.1 = Gruppe + Rolle.
- **Geprüft:** per SQL gegen einen lokalen Stack (Rolle leer, Wiederholung
  idempotent, Fremde sehen vor dem Ende 0 Fotos/Dateien und danach alle,
  Kauf wird genau einmal verbraucht, Direkt-Schreibzugriffe abgelehnt).
  Typecheck und Lint sauber.
- **Nicht geprüft:** die neuen Screens auf einem Gerät; Edge Functions gegen
  RevenueCat; Konto-Löschung end-to-end.
- **Für dich:** einmal `npm run db:reset` im Root, damit dein lokaler Stack das
  neue Schema hat.

Vorläufig entschieden (bitte widersprechen, falls falsch): Looks heissen
Golden, Chrome, Faded, Mono; Events dauern höchstens 31 Tage; nach Event-Ende kann man per Link
weiterhin beitreten, um das Album zu sehen; ein belichtetes Bild wird nie
zurückerstattet.

## M2 · Kamera (gebaut, auf dem Gerät noch nicht geprüft)

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
  `plugins/with-worklets-headers.js` – noch nicht durch einen Build bestätigt.
- **Zoom:** Stopps aus den Linsenwechselpunkten des Geräts, beschriftet relativ
  zur Weitwinkellinse (zeigt den echten Tele-Faktor).
- **Blitz:** jetzt der echte Kamerablitz (`flashMode: 'on'`); Frontkamera:
  weisser Bildschirm.
- **Auflösung:** Fotos in 4:3 bis 3024×4032.
- **Build läuft, Kamera öffnet (15.11.2026).** Zoom-Stopps auf dem Gerät: 0.5×, 1×, 5×.
- **Absturz nach einiger Zeit im Sucher:** vermutlich Speicher (zu grosse
  Vorschau-Frames, jeder wird kopiert). Gegenmassnahme: kleinere Frames, 30 fps.
  Ursache nicht bewiesen, Fix nicht auf dem Gerät bestätigt.
- **Looks neu abgestimmt:** nur noch Farbschema (gedämpft, sauber), kein Korn im
  Sucher, kaum Korn/Vignette im Foto. Entschieden nach Referenzbildern des Nutzers.
- **Runde 6 (15.11.2026):** Frontkamera stand auf dem Kopf → Frames werden nativ
  gedreht. Vorschaubilder zeigten kurz das ungefilterte Foto → Queue entwickelt
  jetzt zuerst (dann Claim, dann Upload) und zeigt nur entwickelte Bilder.
  Blitz: LED wird vor der Aufnahme als Lampe eingeschaltet, zusätzlich zum
  Kamerablitz. Absturz: Frame-Worklet kann keine Exception mehr nach aussen
  werfen, React Compiler für `camera.tsx` aus. **Absturzursache weiter unbekannt,
  nichts davon auf dem Gerät bestätigt.**
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
  (quer gehalten = Querformat). **Nur JS, kein neuer Build nötig. Nichts davon
  auf dem Gerät bestätigt.**
- **Auf dem Gerät prüfen (Runde 7):** Speicheranzeige im Sucher über 1–2 Minuten
  (muss flach bleiben), Flüssigkeit der Vorschau, Frontkamera aufrecht und
  gespiegelt, Auslöser nach Kamerawechsel, Blitz (Logs `[camera] fire` /
  `[camera] torch`), Querformat-Foto. Bekanntes Restrisiko: Skia wird auf dem
  Kamera-Thread noch für die Pixelkopie aufgerufen (kein GPU-Zugriff).
- **Letztes Foto** als Kachel unten links (`lib/my-shots.ts`), Tipp öffnet „Your shots“.
- **Follow-up:** `GrainOverlay` kachelt auf grossen Flächen nicht (auch Landing).
- **03:** Beide Kartenreihen passen ohne Scrollen auf ein iPhone 16.
- **Geprüft:** Typecheck und Lint sauber; `claim_shot` lehnt bei nicht
  gestartetem Event mit `event_closed` ab (gegen den lokalen Stack).
- **Nicht geprüft – die VisionCamera-Fassung ist nie gebaut oder gelaufen:**
  iOS-Build mit den neuen nativen Modulen, Live-Shader und seine Flüssigkeit,
  Zoom-Stopps und ihre Beschriftung, Blitz, Ausrichtung und Grösse der Fotos,
  Kachel mit letztem Foto, „Your shots“, 03 ohne Scrollen, Upload in den Bucket,
  Verhalten nach App-Kill und im Funkloch.
- **Für dich:** neuer Dev-Build nötig (`react-native-vision-camera` + Skia- und
  Worklets-Plugin, Nitro, `react-native-worklets` 0.8.3).
- **Offen:** Look-Rezepte an echten Partyfotos abstimmen; Beispielbild evtl.
  ersetzen; `developPhoto()` blockiert den JS-Thread kurz (bei Serienaufnahmen
  ggf. in eine Worklet-Runtime verlegen).

## Upgrade auf Expo SDK 58 (15.11.2026, auf dem Gerät nicht geprüft)

- Auf Wunsch von SDK 54 direkt auf **SDK 58**: RN 0.88, React 19.3, TypeScript 6,
  Reanimated 4.7, Worklets 0.13 (Pin auf 0.8.3 entfernt), Gesture Handler 3,
  Skia 2.14, expo-router 58 (ohne React Navigation). Neu: `expo-glass-effect`.
- Angepasst: Router-Importe, asynchrone Datei-Operationen in der Upload-Queue,
  neue `expo-media-library`-API (QR speichern auf 09), Ref-Typen, ESLint-Regeln
  (drei React-Compiler-Regeln aus, siehe `eslint.config.js`).
- **Geprüft:** Typecheck, Lint, `expo-doctor` (20/20), iOS-Bundle-Export.
- **Nicht geprüft:** kein nativer Build. Ob VisionCamera 5.2.4 mit Worklets 0.13
  und RN 0.88 baut und läuft, ist offen; ebenso ob
  `plugins/with-worklets-headers.js` noch nötig ist (bleibt vorerst drin).
- **Für dich:** neuer Dev-Build nötig (laut Release-Notes iOS-27-SDK / Xcode 27;
  Mindestversion iOS 16.4). Der alte Build lädt das neue Bundle nicht. Rückweg:
  Commit `79b7413`.

## M3 · Entwickeln & Album (gebaut, auf dem Gerät nicht geprüft)

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
- **Nicht geprüft (alles Sichtbare):** Aussehen und Gefühl von Viewer, Reveal,
  Karussell und Glas; Liquid Glass auf iOS 26; Speichern/Teilen; Löschen gegen
  die RLS; Cover-Abfragen gegen den Stack; Verhalten offline.
- **Bekannte Lücken:** Teilen geht nur auf iOS (RN-`Share` kann auf Android
  keine Datei senden); „offline" hat keinen eigenen Zustand, nur die
  Fehlermeldung; der Viewer nutzt die in Gesture Handler 3 veraltete
  Builder-API (wie die Kamera).

### Vorschlag: Glas & Bewegung in den übrigen Screens (noch nicht umgesetzt)

Bitte ankreuzen, was gebaut werden soll:

1. **13 Kamera:** Zähler, Blitz, Kamerawechsel, Zoom-Leiste, Foto- und
   Einladungs-Kachel als `Glass` über dem Sucher (zuerst auf dem Gerät prüfen,
   dass Glas über dem Skia-Canvas sauber zeichnet).
2. **`PillButton` / `CircleIconButton`:** Reaktion beim Antippen mit Feder
   (Skalierung) statt Transparenz beim Loslassen — wirkt in der ganzen App.
3. **01 Landing, 08 Join, Sheets:** `GlassPanel` auf `Glass` umstellen; Sheets
   mit dem Finger ziehbar, Feder mit Geschwindigkeitsübergabe.
4. **18 Toast:** `Glass` und Feder statt fester Kurve.
5. **Popover (04):** wächst aus dem auslösenden Element.
6. **09 Einladung / 10 Gruppe:** Chips federn beim Beitritt herein; QR-Karte
   bleibt deckend (Glas würde das Scannen stören).
7. **20 Einstellungen, 11/12, Onboarding:** kein Glas (kein Bild dahinter), nur
   Punkt 2.

## M4 · Benachrichtigungen

- Push (`expo-notifications`): „Eure Fotos sind entwickelt“, Erinnerung kurz vor Ende.
- Die zwei Schalter in den Einstellungen bekommen Wirkung; Texte anpassen.

## M5 · Web & Einladungen

- `leftmoment.com`: Landingpage, `/j/{CODE}` → Store-Weiterleitung,
  `apple-app-site-association` und `assetlinks.json` für Universal/App Links.
- Terms/Privacy öffentlich hosten.
- Optional: Web-Album (siehe offene Punkte).

## M6 · Launch-Reife

- Rechtstexte auf Fotos umschreiben und prüfen lassen (Bilder von Personen,
  DSG/DSGVO, Aufbewahrung, Löschung); alle `[KLAMMER]`-Werte füllen.
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
