# LEFT — Launch-Runbook

Stand: 2026-11-16. Alles hier kann nur der Kontoinhaber tun (Konten, Käufe,
Geräte). Die Reihenfolge ist so gewählt, dass jeder Schritt nur braucht, was
davor steht. Was im Code schon vorbereitet ist, steht jeweils dabei.

Legende: ☐ offen · Befehle im Repo-Root, wenn nichts anderes steht ·
`<…>` = Wert, den du einsetzt. Menüpfade in fremden Dashboards können leicht
anders heissen.

**Kurzfassung der Reihenfolge**

1. Firma/Kontaktangaben festlegen, Rechtstexte prüfen lassen
2. Domain kaufen, Website auf Cloudflare Pages
3. Supabase-Produktion
4. Apple / Google Entwicklerkonten, Team-ID, Fingerprint
5. Push-Zugangsdaten
6. Produkte in den Stores + RevenueCat
7. Analytics (optional)
8. Builds iOS / Android
9. TestFlight-Beta an einer echten Party
10. Store-Einträge, Einreichen

---

## 0 · Vorab entscheiden

- ☐ **Betreiber:** Name/Rechtsform, Postadresse, Kontakt-E-Mail (z. B.
  `support@leftmoment.com`). Diese drei Werte brauchen die Rechtstexte, beide
  Stores und die Website.
- ☐ **Rechtstexte prüfen lassen.** Quelle: `mobile/src/constants/legal.ts`
  (App und Website lesen dieselbe Datei). Die Stellen für die Anwältin sind
  mit `REVIEW:` markiert: Mindestalter, Widerrufsrecht bei digitalen Inhalten,
  Haftung, Gerichtsstand, Rechtsgrundlage für abgebildete Dritte, Verbleib der
  Fotos eines gelöschten Kontos in fremden Alben, Auslandtransfers.
- ☑ (2026-11-16, ohne Rechtsprüfung, Entscheid des Betreibers; kein
  EU-Vertreter benannt) In `legal.ts`: alle `[KLAMMER]`-Werte füllen, `LEGAL_DRAFT = false`,
  `LEGAL_UPDATED` setzen; in `web/astro.config.mjs` `/terms/` und `/privacy/`
  aus `UNLISTED` nehmen; `contactEmail` in `web/src/site.ts` setzen.
- ☐ **Die Entscheide der Nacht-Session bestätigen** (`docs/MILESTONES.md`,
  Abschnitt „Entscheide der Nacht-Session").

## 1 · Domain und Website

1. ☐ `leftmoment.com` kaufen (am einfachsten direkt bei Cloudflare Registrar,
   sonst Nameserver auf Cloudflare zeigen lassen).
2. ☐ Cloudflare → Workers & Pages → Create → Pages → mit dem GitHub-Repo
   verbinden. Einstellungen: Root directory `web`, Build command
   `npm run build`, Output `dist`, Node 22.
   Die Website importiert `mobile/src/constants/legal.ts` — Pages klont das
   ganze Repo, das funktioniert ohne Zusatz.
3. ☐ Custom domain `leftmoment.com` (und `www` → Weiterleitung) aufschalten.
4. ☐ E-Mail: Cloudflare Email Routing für `support@leftmoment.com` → dein Postfach.
5. ☐ Prüfen (erst sinnvoll nach Schritt 4, wenn Team-ID und Fingerprint drin sind):
   - `https://leftmoment.com/.well-known/apple-app-site-association` → 200,
     `application/json`, keine Weiterleitung
   - `https://leftmoment.com/.well-known/assetlinks.json` → 200
   - `https://leftmoment.com/j/DEV123` zeigt die Einladungsseite

## 2 · Supabase-Produktion

1. ☐ Projekt anlegen, Region **EU** (Frankfurt oder Zürich), Plan **Pro**
   (tägliche Backups; Free pausiert Projekte). Den Regionsnamen in
   `legal.ts` bei `[HOSTING REGION]` eintragen.
2. ☐ Database → Extensions: **`pg_cron`** und **`pg_net`** einschalten
   (Vault ist standardmässig an).
3. ☐ Schema einspielen:
   ```bash
   npx supabase link --project-ref <ref>
   npm run db:push
   ```
4. ☐ Prüfen im SQL-Editor — es müssen **drei** Jobs dastehen
   (`develop-expired-events`, `notifications-tick`, `purge-expired-events`):
   ```sql
   select jobname, schedule from cron.job order by 1;
   ```
   Fehlt einer, war eine Extension beim Push noch aus: einschalten und den
   `do $$ … $$`-Block am Ende der jeweiligen Migration nochmals ausführen.
5. ☐ **Vault-Secrets**, damit die Datenbank die Edge Functions wecken kann
   (Push und Löschfrist). Als Key den **Legacy-`service_role`-JWT** nehmen
   (Settings → API Keys → Legacy), nicht den neuen `sb_secret_…`:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<service_role JWT>', 'service_role_key');
   ```
6. ☐ Edge Functions und ihre Secrets:
   ```bash
   npx supabase secrets set REVENUECAT_WEBHOOK_SECRET='<langer Zufallswert>'
   npx supabase secrets set REVENUECAT_SECRET_API_KEY='sk_…'      # aus Schritt 5
   npx supabase functions deploy create-event delete-account restore-purchases \
     revenuecat-webhook send-notifications purge-expired-events
   ```
7. ☐ Authentication → Sign In / Providers:
   - **Anonymous sign-ins: an** — sonst scheitert jeder Gast-Beitritt still.
   - Google und Apple gemäss `mobile/docs/social-sign-in.md`.
   - **Email-Provider: aus.** Die App nutzt nur Google, Apple und anonyme
     Sitzungen; mit offenem Email-Signup kann sich jeder per API ein Konto ohne
     Google/Apple anlegen und Events hosten. („Allow new users to sign up"
     bleibt an — sonst kommen weder Gäste noch neue Hosts hinein.)
   - **Manual linking: an** (Authentication → Settings, „Allow manual
     linking"). Ohne das scheitert „Keep your film" — der Gast kann sein
     anonymes Konto nicht mit Google/Apple verbinden.
   - Rate Limits: „Anonymous sign-ins" pro IP auf einen Wert, der eine Hochzeit
     im selben WLAN aushält (Vorschlag: 300 / Stunde).
   - **CAPTCHA noch NICHT einschalten.** Die App schickt kein CAPTCHA-Token
     mit; mit eingeschaltetem CAPTCHA kann kein Gast mehr beitreten. Das
     braucht zuerst Client-Arbeit (Turnstile in einer WebView) — offener Punkt.
8. ☐ Storage: der private Bucket `photos` kommt aus der Migration. Nichts zu tun.
   Achtung: Datenbank-Backups enthalten **keine** Dateien. R2 ist vorbereitet
   (eine Naht: `mobile/src/lib/storage.ts`), aber nicht nötig zum Start.
9. ☐ Backups: Pro macht tägliche Backups (7 Tage). In `legal.ts`
   `[BACKUP RETENTION]` entsprechend füllen. PITR ist optional.
10. ☐ `mobile/.env` für Produktion / EAS-Umgebung „production":
    `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
11. ☐ Rauchtest im SQL-Editor: `select public.dispatch_notifications();` → `false`
    (nichts zu senden) ohne Fehlermeldung; `select public.dispatch_purge();` → `false`.

## 3 · Apple und Google: Konten, Team-ID, Fingerprint

1. ☐ Apple Developer Program (99 USD/Jahr). In App Store Connect: **Paid Apps
   Agreement** unterschreiben, Bank- und Steuerdaten ausfüllen — ohne das
   liefern die Stores eine leere Produktliste.
2. ☐ Google Play Console (25 USD einmalig), Händlerprofil einrichten.
3. ☐ **Team-ID** (Apple Developer → Membership) in
   `web/public/.well-known/apple-app-site-association` statt
   `REPLACE_WITH_APPLE_TEAM_ID` eintragen.
4. ☐ **Android-Fingerprint:** nach dem ersten Android-Build
   `cd mobile && eas credentials` → Android → SHA-256 des Upload-Keys; nach
   dem ersten Play-Upload zusätzlich den „App signing key" aus der Play Console
   (Setup → App signing). Beide in
   `web/public/.well-known/assetlinks.json` (das Feld ist eine Liste).
5. ☐ Website neu deployen, dann die Prüfungen aus 1.5.

## 4 · Push-Zugangsdaten

Der Code ist fertig (`mobile/src/lib/push.ts`, `send-notifications`). Es fehlen
nur Schlüssel:

- ☐ **iOS:** beim nächsten `eas build -p ios` die Frage „Set up Push
  Notifications" mit Ja beantworten — EAS legt den APNs-Key an und hinterlegt
  ihn bei Expo.
- ☐ **Android:** Firebase-Projekt anlegen, Android-App `com.leftmoment.app`
  hinzufügen, `google-services.json` nach `mobile/` legen und in
  `mobile/app.json` unter `expo.android.googleServicesFile` eintragen. Dann
  in Firebase einen Service-Account-Key erzeugen und mit `eas credentials` →
  Android → „Google Service Account Key for FCM V1" hochladen.
- ☐ Test auf einem echten Gerät (Simulator hat kein Token): als Gast einem
  Event beitreten, Mitteilungen erlauben, Host tippt „Film jetzt entwickeln" →
  innert einer Minute kommt „Your photos are developed". Kontrolle:
  ```sql
  select kind, recipients, skipped, sent_at from public.notifications order by created_at desc limit 5;
  ```
- ☐ Erinnerung testen: Event mit Ende in ~4 h erstellen, starten; 60 min vor
  Ende kommt die Erinnerung (nur an Gäste mit Restbildern).

## 5 · Produkte: App Store Connect, Play Console, RevenueCat

Details und Fallstricke: `mobile/docs/payments.md`.

1. ☐ In **beiden** Stores vier **Consumables** mit identischen IDs:

   | Produkt-ID | Preis | deckt |
   |---|---|---|
   | `left_small` | US$ 9.99 | bis 50 Gäste, ∞-Rolle |
   | `left_medium` | US$ 14.99 | bis 100 Gäste |
   | `left_large` | US$ 19.99 | bis 150 Gäste |
   | `left_unlimited` | US$ 24.99 | bis 200 Gäste |

   Anzeigename z. B. „Event up to 100 guests"; IDs nach dem Livegang nie umbenennen.
2. ☐ RevenueCat: Projekt, iOS- und Android-App (`com.leftmoment.app`),
   App-Store-Shared-Secret und Play-Service-Account hochladen, die vier
   Produkte importieren — **kein Entitlement, kein Offering**.
3. ☐ SDK-Keys (`appl_…`, `goog_…`) in `mobile/.env` / EAS;
   `sk_…` als Supabase-Secret (Schritt 2.6).
4. ☐ Webhook in RevenueCat auf
   `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`, Authorization =
   derselbe Wert wie `REVENUECAT_WEBHOOK_SECRET`; je ein Ziel für PRODUCTION
   und SANDBOX.
5. ☐ Sandbox-Kauf testen (TestFlight): 51+ Gäste wählen → kaufen → Event
   entsteht; danach `select product_id, consumed_at from public.purchases`.
   Der Server-Teil (Webhook schreibt die Zeile) ist lokal geprüft, der Weg
   über RevenueCat und den Store noch nie.

## 6 · Analytics (optional, empfohlen vor der Beta)

Gemäss `mobile/docs/analytics.md`: PostHog-Konto (EU-Cloud), Projekt-Key als
`EXPO_PUBLIC_POSTHOG_KEY`. Ohne Key sendet die App nichts.

## 7 · Builds

Ein **neuer nativer Build ist nötig** (neu seit dem letzten Build:
`expo-notifications`, `expo-sharing`).

- ☐ iOS: `cd mobile && eas build -p ios --profile development` (oder der
  GitHub-Workflow `ios-dev-build.yml`), auf dem Gerät prüfen — Liste in
  Abschnitt 8. Für TestFlight: `eas build -p ios --profile production`, dann
  `eas submit -p ios`.
- ☐ Android: `eas build -p android --profile development`. **Android wurde noch
  nie gebaut** — rechne mit einer Runde Fehlersuche (VisionCamera, Worklets,
  Skia). Danach die ganze App einmal durchgehen; insbesondere Kamera, Blitz,
  Speichern, Teilen (`expo-sharing`), Deep Links, Google-Anmeldung
  (Android-Client-ID + SHA-1 in der Google-Konsole).
- ☐ Vor dem Produktions-Build: `EXPO_PUBLIC_*`-Werte in der EAS-Umgebung
  „production" setzen (Supabase, Google, RevenueCat, optional PostHog).

### 7a · App Clip (seit 2026-11-16, noch nie gebaut)

Die App Clip (`mobile/targets/clip`, CLAUDE.md → „The App Clip") wird mit
jedem iOS-Build gebaut und in die App eingebettet. Vor dem ersten Build:

- ☐ developer.apple.com → Identifiers: **App Group**
  `group.com.leftmoment.app` anlegen und bei `com.leftmoment.app` aktivieren.
  Für `com.leftmoment.app.clip` legt EAS den Identifier an; dort ebenfalls
  App Group und Associated Domains aktivieren, falls EAS es nicht tut.
- ☐ Erster Build: `eas build -p ios --profile production`. Fragt EAS nach
  Zugangsdaten für `com.leftmoment.app.clip` oder scheitert die Signierung
  der Clip, einmal `cd mobile && eas credentials` → iOS → das Profil
  „production" → für **beide** Bundle-IDs Zertifikat und Provisioning Profile
  erzeugen lassen. (`@bacons/apple-targets` sagt selbst, dass die Signierung
  von App Clips auf EAS noch nicht ganz automatisch ist.)
- ☐ **Größe prüfen:** App Store Connect → der Build → App Clip → „App Clip
  Size". Muss unter **15 MB** liegen (Aufruf per QR-Code, ab iOS 17).
  Erwartet: 2–4 MB.
- ☐ App Store Connect → App → App Clip: **Default App Clip Experience**
  (Titel „Join the film", Untertitel, Bild 1800×1200, Aktion „Open") und
  eine **Advanced App Clip Experience** für die URL
  `https://leftmoment.com/j/` (Präfix — gilt für alle Codes).
- ☐ Die Website mit dem `appclips`-Eintrag in
  `.well-known/apple-app-site-association` muss live sein, bevor Apple die
  Domain prüft (App Store Connect zeigt den Status der Experience).
- ☐ **Live Activity der Clip (seit 2026-11-18):** EAS hat die Bundle-ID
  `com.leftmoment.app.clip.activity` angelegt, kann ihre Capabilities aber
  nicht setzen (Apples API kennt „App Clip Extension" nicht). Darum von Hand:
  developer.apple.com → Identifiers → `com.leftmoment.app.clip.activity` →
  **„On Demand Install Capable for App Clip Extensions"** und **App Groups**
  (`group.com.leftmoment.app`) einschalten → Save. Der Build-Workflow setzt
  `EXPO_NO_CAPABILITY_SYNC=1`: **jede neue Capability an irgendeiner
  Bundle-ID muss seitdem hier von Hand eingeschaltet werden.** Scheitert die
  Signierung trotzdem: `cd mobile && eas credentials` → iOS → „production"
  → für diese dritte Bundle-ID ein Provisioning Profile erzeugen lassen.
- ☐ Testen ohne Store, **mit TestFlight:** App Store Connect → TestFlight →
  der Build → „App Clip Invocations" → Titel + URL
  `https://leftmoment.com/j/DEVTEST` → Save; auf dem iPhone in der
  TestFlight-App → LEFT → App Clips → Open. („Local Experiences" in den
  Entwickler-Einstellungen gehen nur mit einer per Xcode installierten
  Clip, nicht mit TestFlight.)

### 7b · Die Demo (seit 2026-11-23, lokal geprüft, noch nicht live)

`leftmoment.com/j/TRYLEFT` und das schwebende „Try LEFT“-Badge auf der Website.
Reihenfolge — vorher zeigt der Link nur „Couldn’t start the demo“:

1. Migration `20261123010000_demo.sql` (und davor `20261123000000_gallery_before_develop.sql`)
   auf das gehostete Projekt: `npm run db:push`.
2. Die Beispielgäste einmal anlegen (Publishable Key genügt):
   `SUPABASE_URL=… SUPABASE_KEY=… node web/scripts/seed-demo.mjs LEFTDEMPLATE`
   in `web/`. Ein zweiter Lauf wird mit „full“ abgelehnt — das ist richtig so.
3. Website pushen (Badge + Demo im Browser sind dann live).
4. Neuer EAS-Build: erst damit öffnet der QR-Code den App Clip in der Demo
   (ältere Clips melden „This invite link doesn’t work“). Der Clip-Code der
   Demo und des neuen Albums wurde noch nie kompiliert.
5. Auf dem iPhone prüfen: QR vom Desktop scannen → Clip → 5 Fotos →
   „Develop now“ → Album → „Get LEFT“.

## 8 · Auf dem Gerät prüfen (noch nie gesehen)

- ☐ Glas über dem Sucher (Blitz/Zähler/Wechsel oben, Shots/Zoom/Einladung unten)
- ☐ Mitteilungs-Abfrage: erscheint beim Warten (12), auf der Einladung (09) und
  ~1 s nach dem ersten Foto — und nur einmal
- ☐ Tipp auf „developed"-Mitteilung öffnet das Album, auf die Erinnerung die Kamera
- ☐ Einstellungen: beide Schalter; aus → keine Mitteilung dieser Art; bei
  verweigerter Berechtigung erscheint der Hinweis mit „Open Settings"
- ☐ Abmelden → das Gerät bekommt keine Mitteilungen des alten Kontos mehr
- ☐ Rechtstexte in der App (kein Entwurfs-Hinweis mehr seit 2026-11-16)
- ☐ Blitz zündet wirklich, Speicheranzeige im Sucher bleibt flach, Querformat-Foto,
  App-Kill und Funkloch (aus M2 offen)
- ☐ Löschen als Host und als Gast, „Reduce Motion", „Reduce Transparency" (aus M3 offen)
- ☐ **App Clip** (ohne installierte App): QR scannen → Karte → Name →
  Warten/Kamera; Live-Look im Sucher entspricht dem Look des Films; Foto mit
  Blitz (hinten) und weißem Bildschirm (vorne); Querformat; Zähler sinkt;
  Funkloch → Fotos landen später; nach dem Entwickeln „Get LEFT"
- ☐ **Clip, Stand 2026-11-18:** Sucher bildschirmfüllend, Glas darüber
  lesbar; Zoom-Stufen (0.5× / 1× / Tele) und nach dem Pinch die „1.2×"-Pille;
  das Foto zeigt genau den Ausschnitt des Suchers; „Markus" wählen füllt den
  Namen und bringt seine persönliche Mission; **Live Activity** auf dem
  Sperrbildschirm und in der Dynamic Island („4 left", Missionen, Countdown),
  ein Tipp öffnet die Kamera der Clip
- ☐ **Clip, nächster Build nach 1.2.0 (Commit `5f25e37`, noch nie kompiliert):**
  Clip ohne Link öffnen (TestFlight → „Open" beim Clip, ohne Invocation) →
  „Scan an invite" zeigt den Knopf **„Try the demo"**, ein Tipp öffnet die
  Demo-Kamera. Und: `leftmoment.com/j/TRYLEFT` mit langsamem Netz öffnen
  (Entwickler-Einstellungen → Network Link Conditioner, „3G") → es bleibt der
  Ladekreis bis zur Kamera, „Scan an invite" blitzt nicht mehr dazwischen auf
- ☐ **Übergabe:** nach Fotos in der Clip die App installieren und öffnen →
  derselbe Gast, der Film steht in Moments, der Zähler stimmt

## 9 · TestFlight-Beta an einer echten Party

Ziel: 20+ Gäste, schlechtes WLAN, gemischte Geräte. Erst danach einreichen.

Vorher
- ☐ Produktions-Supabase, Domain live, Universal Link öffnet die App
- ☐ TestFlight: externe Testgruppe, öffentlicher Link (braucht eine kurze
  Beta-Prüfung von Apple — 1–2 Tage einplanen)
- ☐ Event am Vortag erstellen, QR ausdrucken (09 → „Save QR")
- ☐ Eine Person ohne App den ganzen Weg gehen lassen: QR → Store/TestFlight →
  Link nochmals tippen → Name → Kamera (der Code überlebt die Installation nicht)

Während
- ☐ Wie viele Gäste schaffen den Beitritt ohne Hilfe? Wo bleiben sie hängen?
- ☐ Zähler stimmt bei jedem; niemand kann mehr Fotos machen als die Rolle
- ☐ Flugmodus-Test: 5 Fotos offline, dann online → alle kommen an
- ☐ Akku/Wärme nach 10 min im Sucher; Absturz? (TestFlight-Crashes ansehen)

Danach
- ☐ Erinnerung kam 60 min vor Ende, „developed" kam beim Ende
- ☐ Reveal spielt bei allen; Album vollständig (Anzahl Fotos = Summe der Zähler)
- ☐ Speichern einzeln/alle, Teilen
- ☐ Zahlen: Beitritte, Fotos pro Gast, Reveal-Quote (PostHog oder SQL):
  ```sql
  select count(*) as gaeste, sum(shots_taken) as fotos from public.event_members where event_id = '<id>';
  ```
- ☐ Look-Rezepte an den echten Fotos beurteilen (`constants/looks.ts`)

## 10 · Store-Einträge

### Texte (Entwurf — Englisch, die App ist englisch)

**Name (30):** `LEFT – Disposable Event Camera`

**Subtitle (30):** `One roll each. Reveal together`

**Promotional text (170):** (165 Zeichen, Stand 2026-11-19 mit Missionen)
`Give every guest a roll of film and a secret mission. No sign-up, just a link or a QR code. The photos stay hidden until it’s over — then everyone sees them at once.`

**Keywords (100):**
`guest,album,film,qr,birthday,reveal,retro,vintage,analog,shared,group,roll,bachelorette,reunion,trip`

**Description:**

```
LEFT turns every guest's phone into a disposable camera.

Create an event, share a link or a QR code, and every guest gets the same limited roll of photos. No account, no sign-up — a name is enough. Nobody sees anything until the event ends. Then the whole film is developed at once, and the group gets one shared album.

HOW IT WORKS
• Create your event and pick a film look: Golden, Chrome, Faded or Mono
• Choose the roll: 5, 10, 16, 24 or 36 photos per guest — or unlimited
• Invite by link or QR code. Guests join in seconds, without an account
• Everyone shoots. The counter shows how many photos are left
• When the event ends, the photos are developed for everyone at the same time

MISSIONS
Turn them on and every guest gets one to three secret photo missions — "a toast, just as the glasses meet", "a photo with someone you have never met". Write your own, name people who should get a personal one, or use ours. Missions are free on every event, and in the album each photo shows the mission it answered.

WHY A LIMITED ROLL
Because 24 photos get chosen. People look up, wait for the moment, and take the picture that matters — like the disposable cameras on the tables at a wedding, without collecting and developing them.

MADE FOR
Weddings, birthdays, parties, bachelorettes, trips, graduations, reunions and company events.

FAIR PRICING
Free for up to 50 guests. Bigger groups or an unlimited roll are a one-time payment per event — no subscription.

PRIVATE BY DESIGN
Photos are visible only to the members of the event, and only once it is developed. The host can remove any photo, and every member can report one. Events and their photos are deleted after six months — save what you want to keep.

Terms: https://leftmoment.com/terms/
Privacy: https://leftmoment.com/privacy/
```

**Google Play short description (80):**
`A disposable camera for your event. One roll per guest, revealed together.`

Deutsch (für den Schweizer Store, optional):
- Untertitel: `Eine Rolle pro Gast`
- Kurzbeschreibung: `Die Einwegkamera für euer Fest. Eine Rolle pro Gast, gemeinsam entwickelt.`
- Beschreibung: die englische übersetzen, sobald die englische steht.

### Screenshots (6.9" iPhone, 1320×2868; Play: 1080×1920+)

Fertig gerendert in `store-assets/` (8 Stück, Stand 2026-11-18):

1. Kamera, Vollbild-Sucher, „Missions 1/3" — „One roll each. Make every shot count."
2. Missionen des Gasts — „A secret dare in every pocket."
3. Entwickeltes Album — „The whole night, developed together."
4. Foto im Viewer mit „Mission · …" — „Every dare gets its answer."
5. Einladung mit QR (09) — „One scan. Everyone's in."
6. Look-Auswahl (03) — „Pick the film for your night."
7. „Nothing to see yet" mit Countdown — „Hidden until it's over."
8. Moments — „Every event, one album."

Fotos darin: eigene Bilder mit Einwilligung der Abgebildeten, keine Stockfotos.

### Angaben, die die Stores verlangen

- ☐ **Datenschutz-URL** `https://leftmoment.com/privacy/`, Support-URL, Marketing-URL
- ☐ **App Privacy (Apple) / Data Safety (Google)** — gesammelt, nicht fürs
  Tracking: Kontaktdaten (Name, E-Mail bei Anmeldung), Nutzerinhalte (Fotos),
  Kennungen (Nutzer-ID, Geräte-ID für Push), Käufe, Nutzungsdaten und
  Diagnose (nur wenn PostHog aktiv). Keine Standortdaten, kein Tracking.
- ☐ **Altersfreigabe:** nutzergenerierte Inhalte → voraussichtlich 12+.
- ☐ **Review-Notizen:** Testkonto ist nicht nötig (Gast-Beitritt ohne Konto);
  einen laufenden Demo-Event mit Einladungslink angeben; erwähnen, dass
  Löschen des Kontos unter Settings → Delete Account liegt.
- ☐ **Risiko bei der Prüfung (Apple 1.2, nutzergenerierte Inhalte):** verlangt
  werden Melden, Blockieren und eine Kontaktadresse. Vorhanden: Host kann jedes
  Foto löschen, jeder sein eigenes, und **„Foto melden"** im Viewer (Fahne bei
  fremden Fotos → `report_photo()` → Tabelle `photo_reports`; seit 2026-11-16).
  In den Review-Notizen erwähnen. **Offen:** Es gibt keine Benachrichtigung an
  dich — die Meldungen muss jemand täglich ansehen (Abfrage in Abschnitt 11),
  denn App und AGB versprechen eine Prüfung innert 24 Stunden. Ebenfalls nicht
  vorhanden: einen Nutzer blockieren.
- ☐ Export Compliance: `ITSAppUsesNonExemptEncryption = false` steht schon in `app.json`.

## 11 · Nach dem Launch im Auge behalten

- **Täglich: gemeldete Fotos.** Offene Meldungen:
  ```sql
  select id, created_at, event_id, photo_id, photo_owner_id, storage_path
    from public.photo_reports where resolved_at is null order by created_at;
  ```
  Foto ansehen: Storage → Bucket `photos` → `storage_path`. Entfernen: die Datei
  und die Zeile in `public.photos` löschen. Danach
  `update public.photo_reports set resolved_at = now(), resolution = '<was getan wurde>' where id = '<id>';`
- `select * from cron.job_run_details order by start_time desc limit 20;` — laufen die drei Jobs?
- `select kind, skipped, count(*) from public.notifications group by 1,2;`
- Supabase: Storage-Grösse und Egress; RevenueCat: Käufe = Zeilen in `public.purchases`
- TestFlight / Play Console: Abstürze (native Crashes sieht PostHog nicht)
