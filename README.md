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
| `WASD` / Pfeiltasten | Laufen / Fahren |
| `E` | Auto klauen / aussteigen, Mission am gelben Marker starten |
| `Leertaste` | Handbremse (Drift) |
| `F` oder Mausklick | Schießen |
| `P` | Pause |
| `M` | Ton an/aus |
| `R` | Nach WASTED / BUSTED neu starten |
| `Enter` | Spiel starten |

## Features

- Offene Welt (3600×3600 px) mit Straßenraster, Verkehr, Fußgängern und Kollisionen
- Fahrphysik mit Drift (Handbremse), Schaden und Explosionen
- Wanted-System mit ★-Stufen: Polizei-Verfolgung, Sirenen, Schusswechsel, **WASTED** / **BUSTED**
- 3 Missionstypen an wechselnden Markern: **Taxi**, **Paketlieferung**, **Sprint zum Käfertaler Wald**
- Tag-Nacht-Zyklus mit Straßenlaternen, Scheinwerfern und leuchtenden Neon-Schildern
- Minimap, HUD (Geld, Leben, Sterne, Tacho, Missions-Timer)
- Komplett synthetischer Sound via WebAudio (Motor, Sirene, Schüsse, Explosionen) — keine Audio-Dateien

## Technik

Reines HTML5 Canvas + Vanilla JavaScript, keine Bibliotheken, keine externen Assets.
Dateien: `index.html`, `style.css`, `js/config.js`, `js/audio.js`, `js/map.js`,
`js/entities.js`, `js/main.js`.

## Lokaler Smoke-Test (optional, mit Node.js)

Ein headless Test mit gestubbtem Canvas simuliert Gameplay-Frames:

```bash
node /tmp/smoke.js   # oder eigener Pfad zum Test
```
