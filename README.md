# FRANKLIN VICE — Mannheim-Käfertal

Ein webbasiertes Open-World-Spiel im GTA-Stil (Top-Down, Vice-City-Neon-Look), das in
**Mannheim-Franklin** spielt — dem neuen Stadtteil auf dem Gelände des ehemaligen
Benjamin Franklin Village in Käfertal.

Reine Fan-Parodie zu Spaßzwecken. Enthält echte Straßen- und Ortsnamen aus dem Viertel
(z. B. George-Washington-Straße, James-Monroe-Ring, Wasserwerkstraße, B 38, Käfertaler Wald,
Bahnhof Käfertal, Friedhof Käfertal), aber **keine echte Karte**.

## Spielen

Es ist eine statische Web-App ohne Build-Schritt und ohne Abhängigkeiten:

- Variante A: `index.html` direkt im Browser öffnen (Doppelklick), oder
- Variante B: lokal serven, z. B. `python3 -m http.server` im Projektordner, dann
  <http://localhost:8000> aufrufen, oder
- Variante C: kostenlos auf GitHub Pages veröffentlichen (Repo → Settings → Pages →
  Branch `main`, Ordner `/root`).

## Steuerung

| Taste | Aktion |
| --- | --- |
| `↑` / `↓` (W/S) | Figur vorwärts / rückwärts bewegen (in Blickrichtung) |
| `←` / `→` (A/D) | Figur **drehen** — nur in **10°-Schritten** (Tank-Steuerung); im Auto: lenken |
| automatisch | Folgt die Figur beim Vorwärtslaufen einem kurvigen Weg, dreht sie **ohne weiteres Lenken** in 10°-Schritten der Kurve entlang |
| beliebige Taste | Titel-Screen starten |
| Maus | Zielen (Schussrichtung folgt dem Fadenkreuz) |
| rechte Maustaste ziehen | Kamera um den Spieler drehen (nur 3D) |
| `E` | Auto klauen / aussteigen, Mission am gelben Marker starten |
| `Leertaste` | Handbremse (Drift) |
| `F` oder linker Klick | Schießen |
| `2` / `3` | 2D-Top-Down / 3D-Modus umschalten |
| `P` | Pause |
| `M` | Ton an/aus |
| `R` | Nach WASTED / BUSTED neu starten |
| `Enter` | Spiel starten (alternativ beliebige Bewegungs-Taste) |
| URL-Parameter `?mode=2d` | erzwingt 2D-Modus (z. B. bei WebGL-Problemen) |

## Features

- Offene Welt mit der **echten Straßenkarte des Stadtteils Franklin (Mannheim-Käfertal)** aus
  OpenStreetMap — Ausschnitt **vom Alter Postweg (Westen) bis zur Bensheimer Straße (Süden)**,
  östlich bis Columbusstraße, nördlich bis Käfertaler Wald
  (BBox 8.5185–8.5415 °O / 49.5125–49.5265 °N). Alle Ways werden exakt auf den Ausschnitt
  zugeschnitten; die echten Namen und Verläufe bleiben erhalten: **George-Washington-Straße,
  George-Sullivan-Ring, James-Monroe-Ring, Thomas-Jefferson-Straße, Franklin-D.-Roosevelt-Straße,
  Abraham-Lincoln-Allee, Robert-Funari-Straße, Columbusstraße, Europa-Achse, Waldstraße …**
- **Franklin Loop direkt aus OSM**: der reale, beleuchtete Rundweg ist als eigene Wege
  („Loop“, ~3,3 km, 19 Segmente) kartiert und wird 1:1 übernommen.
- **Straßenbahn exakt auf den realen Schienen**: die neue **Linie 16** (Bensheimer Straße →
  Franklin Mitte → Franklinschule → Sullivan, 1,8 km) plus OEG (Linie 5/15) liegen als Schienennetz
  vor; darauf fahren Straßenbahnen (2D + 3D).

- **Nur offizielle Wege**: Spieler (zu Fuß und im Auto), **alle KI-Figuren, Autos, Lastenräder und
  die Polizei** bewegen sich ausschließlich auf Wegen — der begehbare Korridor endet am
  Fahrbahnrand; die Figur startet und respawnt per Snap auf einem echten Weg. Gebäude, die in OSM auf Straßen liegen, werden entfernt bzw. von der Fahrbahn
  weggetrimmt. **Gebäude stehen nie auf Wegen**: `roadClearance` erkennt jetzt auch Wege, die
  durch das Innere eines Gebäudes verlaufen; solche Gebäude (und Rand-Splitter <120 px²) werden
  ganz entfernt, statt nur den Kollisionskörper zu leeren. **Bäume stehen nie auf Wegen**: bei der
  Platzierung im Wald/Park wird ein Mindestabstand (Baumradius + 5 px) zu jedem Weg und jeder
  Schiene erzwungen. Die **Startposition wird dynamisch gewählt**: Weg-Punkt in Franklin Mitte
  (max. 450 px um den Plaza-POI) mit dem größten Abstand zu allen Gebäuden — der Start-View ist
  nicht von einem Gebäude blockiert.
  Straßennamen werden nie spiegelverkehrt gerendert: In 2D sorgt die Drehrichtungs-
  Korrektur (Drehung nur um die Straßenrichtung, ggf. +180°) für lesbare Schilder; in 3D ist die
  Bodentextur korrekt (flipY) auf die Weltkoordinaten abgebildet, sodass Namen nicht gespiegelt
  erscheinen.
- **Lastenräder** fahren als eigener Verkehr auf Wegen und Nebenstraßen (2D-Icon + 3D-Modell).
  Verkehr und Fußgänger folgen dem echten Straßennetz als Graph.
  *Kartendaten: © OpenStreetMap-Mitwirkende, [ODbL](https://opendatacommons.org/licenses/odbl/1-0/),
  über die OSM-API abgerufen und in `js/geodata.js` eingebettet.*
- Fahrphysik mit Drift (Handbremse), Schaden und Explosionen
- Wanted-System mit ★-Stufen: Polizei-Verfolgung, Sirenen, Schusswechsel, **WASTED** / **BUSTED**
- 3 Missionstypen an wechselnden Markern: **Taxi**, **Paketlieferung**, **Sprint zum Käfertaler Wald**
- Tag-Nacht-Zyklus mit Straßenlaternen, Scheinwerfern und leuchtenden Neon-Schildern
- Minimap, HUD (Geld, Leben, Sterne, Tacho, Missions-Timer)
- Komplett synthetischer Sound via WebAudio (Motor, Sirene, Schüsse, Explosionen) — keine Audio-Dateien
- **3D-Modus** (Standard, wenn WebGL verfügbar; Taste `3`, Taste `2` für 2D): Third-Person-Kamera
  (rechte Maustaste dreht sie), Gebäude mit echten Grundrissen (extrudiert) und prozeduralen
  Fassaden-Texturen (Fenster), Bäume im Käfertaler Wald, Scheinwerfer-Kegel und Neon-Schilder bei Nacht,
  Straßenlaternen, Tag/Nacht-Zyklus mit Sonnenstand, Nebel und Vice-City-Sonnenuntergang.
  Ohne WebGL schaltet das Spiel automatisch auf den 2D-Modus um.
- **Prozedurale Texturen** (keine externen Bilder nötig): Asphalt-Speckle, Gehweg-Platten,
  Rasendetails, Dächer mit Lüftungsdetails — in 2D direkt und in 3D als Boden-/Fassaden-Textur.

Hinweis zu Street-View-Bildern: Google Street View / Apple Look Around dürfen wegen ihrer
Nutzungsbedingungen **nicht** eingebettet oder kopiert werden (und aus dieser Entwicklungsumgebung
ist kein Zugriff darauf möglich). Open-Source-Alternativen wären z. B. **Mapillary** (CC-BY-SA)
oder **KartaView** sowie **Wikimedia Commons** — wer eigene, passend lizenzierte Fotos hat, kann
sie gern ins Repo legen (`textures/`); auf Wunsch baue ich eine Manifest-Anbindung dafür ein.
Aktuell ist die Grafik komplett prozedural und damit lizenzfrei.

## Referenz-Fotos aus Franklin (ohne Anzeige im Spiel)

Fotos aus Franklin (eigene, mit EXIF-GPS) werden **nicht im Spiel angezeigt**.
Sie dienen als Vorlage: `node tools/build_photos.js` liest GPS + Blickrichtung
und schreibt `photos/photos.json` (Foto → nächstgelegenes Gebäude). Anhand der
Fotos werden dann die Gebäude-Polygone in `js/geodata.js` angepasst, damit
Grundriss, Höhe (`building:levels`), Dachform (`roof:shape` — in 3D als
Dachkörper, in 2D als Dachfarbe) und Fassade (Typ-abhängige Textur) den echten
Häusern möglichst nahekommen. Details siehe `photos/README.md`.

## Technik

HTML5 Canvas (2D) + WebGL via **Three.js r149** (MIT-Lizenz, lokal vendored in
`js/vendor/three.min.js` — keine CDN-Abhängigkeit, läuft offline). Gameplay und Sound sind
reines Vanilla JS ohne Abhängigkeiten.
Dateien: `index.html`, `style.css`, `js/config.js`, `js/geodata.js` (OSM-Kartendaten, ODbL),
`js/audio.js`, `js/map.js`, `js/entities.js`, `js/render3d.js`, `js/main.js`,
`js/vendor/three.min.js`.

## Lokaler Smoke-Test (optional, mit Node.js)

Ein headless Test mit gestubbtem Canvas simuliert Gameplay-Frames:

```bash
node /tmp/smoke.js   # oder eigener Pfad zum Test
```
