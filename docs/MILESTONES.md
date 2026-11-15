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

## M3 · Entwickeln & Album

- „Entwickelt sich“-Zustand: Countdown, Anzahl Fotos, nichts sichtbar.
- **Der Reveal** — der eine choreografierte Moment der App.
- Album: Grid mit Thumbnails (`expo-image`), Vollbild-Viewer mit Swipe, Pinch und
  Drag-to-dismiss (interruptible, 1:1, Velocity-Handoff), Fotograf-Badge.
- Speichern (einzeln/alle) und Teilen; Host-Moderation; „Film jetzt entwickeln“
  für den Host (`endEvent()`).
- Gast-Upgrade `(auth)/keep` nach dem Reveal wieder anbinden.
- Film-Karten in der Bibliothek mit echtem Cover; Platzhalter-Komponente löschen.

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
