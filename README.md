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
| `WASD` / Pfeiltasten | Laufen / Fahren (Pfeile: vorwärts/rückwärts/rechts/links; die Figur dreht sich bei Richtungswechsel in **10°-Schritten**) |
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

- Offene Welt (3600×3600 px) mit der **echten Straßenkarte von Mannheim-Käfertal/Franklin**
  aus OpenStreetMap — Straßenverläufe inkl. Kurven, B 38 / A 6, Käfertaler Wald, Friedhof,
  Wasserturm, Bahnhof Käfertal und ~660 echte Gebäude-Grundrisse (kein Planquadrat-Raster).
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

## Eigene Fotos aus Franklin einbinden (GPS/EXIF)

Ja — Fotos mit GPS-Metadaten lassen sich exakt auf der Karte platzieren:

1. Smartphone-Fotos (JPEG mit EXIF-GPS) nach `photos/` legen (nur eigene/lizenzierte Fotos!)
2. `node tools/build_photos.js` ausführen — liest GPS-Koordinaten + Aufnahmerichtung
   (EXIF), projiziert sie auf die OSM-Karte, matched das nächstgelegene Gebäude und
   schreibt `js/photodata.js`
3. `photos/` + `js/photodata.js` committen/pushen

Im Spiel: Kamera-Marker auf Karte & Minimap, 3D-Billboard an der GPS-Position,
großes Foto-Overlay beim Näherkommen (siehe `photos/README.md`).

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
