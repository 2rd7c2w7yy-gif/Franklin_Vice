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
| `↑` / `↓` / `←` / `→` (WASD) | **2D-Modus:** Figur bewegt sich in die jeweilige **Himmelsrichtung** (↑=Norden, ↓=Süden, ←=Westen, →=Osten); steht sie auf einem Weg, **folgt sie dem Wegverlauf automatisch** (auch um Kurven), statt stur geradeaus zu laufen |
| `↑` / `↓` (W/S) | **3D-Modus:** Figur vorwärts / rückwärts bewegen (in Blickrichtung) |
| `←` / `→` (A/D) | **3D-Modus:** Figur **drehen** — nur in **10°-Schritten** (Tank-Steuerung); im Auto (beide Modi): lenken |
| automatisch (3D) | Folgt die Figur beim Vorwärtslaufen einem kurvigen Weg, dreht sie **ohne weiteres Lenken** in 10°-Schritten der Kurve entlang |
| beliebige Taste | Titel-Screen starten |
| Maus | Zielen (Schussrichtung folgt dem Fadenkreuz) |
| rechte Maustaste ziehen | Kamera um den Spieler drehen (nur 3D) |
| `E` | Auto klauen / aussteigen, Mission am gelben Marker starten |
| `Leertaste` | Handbremse (Drift) |
| `F` oder linker Klick | Schießen |
| `2` / `3` (auch ohne Zehnerblock: obere Ziffernreihe `Digit2`/`Digit3`) | 2D-Top-Down / 3D-Modus umschalten — alternativ klickbarer **2D/3D-Button** im HUD oben rechts (neben der Uhr) |
| `P` | Pause |
| `M` | Ton an/aus |
| `H` | kleine Tastenübersicht im HUD ein-/ausblenden (unten links, immer sichtbar) |
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
- **Sahle-California-Doppelhäuser (James-Monroe-Ring) am Alten Postweg**: Die California gehören zum
  **James-Monroe-Ring** (früher Grant Circle) und stehen in **zweiter Reihe hinter den alten
  Bestands-Doppelhäusern** (die bleiben als erste Reihe aus OSM erhalten). Die bereits kartierten
  kurzen **Zufahrten** (Wege) zeigen auf jedes Haus — am **alter-postweg-seitigen Ende** jedes Weges steht ein California
  (zweite Reihe direkt hinter der ersten Reihe). **Die vom Nutzer markierten Positionen** (Screenshot mit
  roten Markierungen) wurden per Screenshot→Welt-Transform (Maßstab 2, Offset exakt per Korrelation bestimmt)
  übernommen: 6 Häuser stehen exakt an den markierten Stellen (ggf. wenige px nach Osten versetzt, damit sie
  nicht auf der Straße stehen; dort befindliche OSM-Gebäude wurden ersetzt). Weitere 9 Häuser ergänzen die
  Reihe an den übrigen Zufahrten — insgesamt 7 California-Häuser (einzeln, nie aufgeteilt/überlappend;
  Platzierung nur mit voller Größe: ≥1,2 px Abstand zu allen Straßen außer der eigenen Zufahrt, sonst wird
  das Haus vom Spiel auf bis zu 25 % verkleinert („zu kleines Haus“) — solche Plätze werden übersprungen).
  Maße: **15 m breit × 8 m tief, 10 m hoch**, **begrüntes Flachdach** (`roof=flat`, Dach grün),
  plus **Dachterrasse Nord und Süd, je 2 m** (helle Streifen an den Schmalseiten). Besonders
  detailliert und **alle mit identischem Design**, als **Staffelgeschoss**: 3 Etagen, die **oberste Etage
  ist je 2 m kürzer** (Nord/Süd zurückgesetzt) — die **Dachterrassen sind Aussparungen im Dachgeschoss**
  (hell gepflastert, je 2 m an Nord/Süd, ohne Geländer/Attika und **ohne jegliche Stangen/Boxen auf dem Dach**).
  Das **südlichste Haus steht an der vom Nutzer lila markierten Stelle** (Screenshot → Welt-Koordinate),
  in voller Größe und ohne Weg im Inneren. In 3D: beige Putzfassade mit je einer
  Fensterreihe pro Etage (3 Fenster pro Längsseite, 3 im Staffelgeschoss) und brauner Haustür,
  nur die Dachfläche grün; das **Staffelgeschoss ist als eigener Körper an Nord UND Süd je 2 m
  zurückgesetzt** (dessen Fenster sitzen an den zurückgesetzten Wänden); in 2D:
  grünes Dach mit dunklerer, zurückgesetzter Dachfläche der obersten Etage + helle Terrassenstreifen an Nord/Süd.
  Name: „Sahle California · James-Monroe-Ring“.
- **Franklin Loop direkt aus OSM**: der reale, beleuchtete Rundweg ist als eigene Wege
  („Loop“, ~3,3 km, 19 Segmente) kartiert und wird 1:1 übernommen.
- **Kreisverkehr (Wasserwerkstr. / James-Monroe-Ring / Franklin-D.-Roosevelt-Str.)**: als Ring aus OSM
  übernommen und als echter Kreisverkehr gezeichnet (schmalere Ringfahrbahn + grüne Mittelinsel).
- **POIs gegen OSM geprüft**: es gibt **keinen Wasserturm** in Franklin (POI entfernt); Respawn liegt an der
  echten **Hausarztpraxis-Franklin**; **FRANKLINSCHULE** und **FRANKLIN KLINIK** sind als gelabelte POIs
  eingetragen (Gebäude existieren zudem als benannte OSM-Gebäude).
- **Straßenbahn exakt auf den realen Schienen**: die neue **Linie 16** (Bensheimer Straße →
  Franklin Mitte → Franklinschule → Sullivan, 1,8 km) plus OEG (Linie 5/15) liegen als Schienennetz
  vor; darauf fahren Straßenbahnen (2D + 3D).

- **Realistische Maßstäbe**: Straßen werden in echter Breite gezeichnet (Skala 0,92 px/m —
  Wohnstraße ≈ 9 px, Hauptstraße ≈ 13–15 px, Fußweg ≈ 4 px), Gehweg-Halo, Mittellinien und
  Kreuzungsflächen skalieren mit. Dadurch sind die **Abstände zwischen den Gebäuden deutlich
  größer als die Straßen** selbst; Gebäude werden passend zurückgetrimmt (Kollisionskörper
  mind. 11 px jenseits jeder Wegkante, damit die Figur überall entlanglaufen kann).
- **Fahrzeuge kompakter**: Autos und Straßenbahnen sind auf 0,75× skaliert (Auto 36×18 px,
  Kollisionsradius 10; Tram 70×19 px) — 2D und 3D.
- **In der 3D-Ansicht sind Figuren und Fahrzeuge kleiner**: Fußgänger/Lastenräder 0,7×, Autos/Straßenbahnen 0,6×
  (Mesh-Skalierung in `render3d.js`).
- **Alle Figuren und Fahrzeuge laufen mit halber Geschwindigkeit**: Spieler 118 px/s (vorher 235),
  KI-Autos max. 270/95 px/s, Fußgänger 22–38 px/s, Lastenräder 30–50 px/s, Straßenbahn 58 px/s.
- **KI-Figuren laufen nicht mehr ständig im Kreis**: Der Walker merkt sich die letzten 8 Wege (`mem`),
  meidet Wiederholungen und quittiert Sackgassen/kleine Ringe nach wenigen Fehlversuchen mit einem
  Respawn auf einem anderen verbundenen Weg (statt endlos hin- und herzulaufen).
- **KI-Autos bleiben nach Auto-Crashs auf der Straße**: Werden zwei Autos auseinandergedrückt, snappen
  KI-Autos sofort zurück auf ihren Fahrstreifen-Punkt (`walkerPoint`) und landen nie außerhalb der Fahrbahn.
- **Tod durch Straßenbahn**: Wer zu Fuß (oder im Auto) von einer Straßenbahn erfasst wird
  (Körper-Segment der Bahn vs. Spieler), stirbt sofort — „WASTED“-Screen inkl. Blutwolke,
  Crash-Sound und Screen-Shake. Das Auto wird zerstört.
- **James-Monroe-Ring bebaut**: 88 in OSM vorhandene, bisher fehlende Gebäude (Ways +
  Multipolygon-Relation, v. a. Reihenhäuser/Terrassen im Ring) wurden aus OSM ergänzt;
  die Mindestfläche pro Gebäude wurde von 120 px² auf 28 px² gesenkt, damit auch kleinere
  Häuser (z. B. im Ring) gerendert werden — der Ring ist jetzt dicht bebaut wie im echten Franklin.
- **Nur offizielle Wege**: Spieler (zu Fuß und im Auto), **alle KI-Figuren, Autos, Lastenräder und
  die Polizei** bewegen sich ausschließlich auf Wegen — der begehbare Korridor endet am
  Fahrbahnrand; die Figur startet und respawnt per Snap auf einem echten Weg. Gebäude, die in OSM auf Straßen liegen, werden entfernt bzw. von der Fahrbahn
  weggetrimmt. - **Beschriftungen nicht mehr störend in der 3D-Ansicht**: Alle Text-Labels (Straßennamen, B 38/A 6, Straßenbahn, FRANKLIN/KÄFERTAL, POI-Schilder) werden auf einen eigenen Layer (`World.labelCanvas`) gezeichnet und nur in der **2D-Ansicht** über die Karte gelegt. Die 3D-Grundtextur (`World.canvas`) enthält **keine Schrift** mehr — in 3D sieht man nur die reine Karte (Neon-Schilder an Gebäudefassaden bleiben als 3D-Sprites erhalten).
- **Keine Gebäude mehr auf Straßenrändern**: Nach dem Zuschneiden müssen Gebäude jetzt mindestens **0,5 px Abstand** zur Fahrbahnkante haben, sonst werden sie verworfen (vorher durften sie bis zu 8 px auf die Straße ragen — in 3D sahen das wie auf der Fahrbahn liegende Blöcke aus).
**Gebäude stehen nie auf Wegen**: `roadClearance` erkennt jetzt auch Wege, die
  durch das Innere eines Gebäudes verlaufen; solche Gebäude (und Rand-Splitter <120 px²) werden
  ganz entfernt, statt nur den Kollisionskörper zu leeren. **Bäume stehen nie auf Wegen**: bei der
  Platzierung im Wald/Park wird ein Mindestabstand (Baumradius + 5 px) zu jedem Weg und jeder
  Schiene erzwungen. Die **Startposition ist Zufall**: ein zufälliger Weg-Punkt irgendwo in Franklin
  (gesnappt auf einen offiziellen Weg, nie in einem Gebäude) — bei jedem Spielstart woanders.
- **Autos nur auf Straßen, nie auf Radwegen/Fußwegen**: KI-Autos fahren mit einem Way-Pool
  (`driveWays`, ohne `path`/cycleway) und dürfen an Knoten **nicht** auf Fuß-/Radwege abbiegen
  (`allowed`-Set im Walker); Spieler-Auto und Polizei werden per `onDrive()` auf Fahrbahnen
  gehalten, geparkte Autos snappen per `snapToDrive()` zurück auf die Straße.
- **2D/3D-Umschalten robust**: Taste `2`/`3` wechselt jederzeit (auch auf dem Titel; beliebige
  Taste startet das Spiel); `3` versucht bei Bedarf ein erneutes WebGL-Init, der automatische
  Fallback zählt Renderfehler nur im 3D-Modus und ist per Taste `3` wieder umkehrbar.
  **Kein Ruckeln an Gebäuden mehr**: Steht die Figur direkt an einer Wand, gleitet sie jetzt an ihr
  entlang (achsengetrennte Bewegung, die Kollision verhindert das Eindringen, bevor es passiert,
  und projiziert die Normalgeschwindigkeit heraus), statt in den Kollisionskörper hinein- und
  herauszuspringen; die 2D-Kamera folgt geglättet (Lerp, harter Schnitt nur bei Respawn/Teleport).
  In 3D bleibt die Kamera außerdem ruckelfrei: geglättetes Kamera-Yaw (die 10°-Drehschritte der Figur
  whippen die Kamera nicht mehr), Boom-Kollision (die Kamera wird entlang des Auslegers vor jedem
  Gebäude/Baum zurückgezogen und liegt nie in einem Solid) und ein hartes Limit von 6 px pro Frame
  Kamerabewegung.
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

## Gebäude-Editor (Edit-Modul)

Auf dem **Titelbildschirm** gibt es den Button **„🛠 GEBÄUDE-EDITOR“** (oder `editor.html` direkt aufrufen).
Ablauf:

1. **Foto/Screenshot hochladen** (eigenes Foto mit EXIF-GPS oder Screenshot aus einer Karten-App als Dachaufsicht).
   Das Foto selbst wird **nicht im Spiel angezeigt und nicht gespeichert** — nur abgeleitete Werte
   (Etagen, Fenster, Türen, Fassaden-/Dachfarbe, Maße). Bitte keine Google/Apple-StreetView-Bilder verwenden (ToS).
2. **Analyse** (nicht vorlagenbasiert, sondern **einzeln pro Öffnung**): Das Modul liest EXIF-GPS (eigener Parser) und analysiert
   Schrägfotos (typisch ca. 30° von vorn/oben, Fassade UND Dach sichtbar). Per Kantenerkennung (Sobel) werden Gebäudetop und
   Traufe gefunden — darüber das **sichtbare Dach**, darunter die **Fassade**. In der Fassade werden **Fenster und Türen einzeln
   als Rechtecke erkannt** (Dunkelmaske + Connected Components, normalized auf die Fassadenfläche, Typ „win“/„door“) — nicht nur
   „N pro Etage im Raster“; Etagen ergeben sich aus den Fensterreihen. Die **Dachform wird aus der Dach-Silhouette klassifiziert**:
   dünne Kante = Flachdach, Dreieck/kurze Firstkante = Satteldach, **Trapez = Walmdach**, Spitze = Pyramidendach (per Select
   jederzeit manuell änderbar). Dachfarbe + Dachhöhe kommen aus der sichtbaren Dachfläche; aus Dachhöhe/Hausbreite und dem
   Kamerawinkel wird die **Tiefe geschätzt** (≈ Dachhöhe / sin(Winkel) × Breite). Die Vorschau und die 3D-Fassadentextur zeichnen
   die Öffnungen an ihren **individuellen Positionen**. Dazu Auto-Erkennung „Schräg-/Seitenansicht“ vs. „Dachaufsicht“.
   Die Dunkelmaske arbeitet mit **lokalem Kontrast** (Pixel vs. lokalem Hintergrund per Box-Blur), daher werden Fenster auch bei
   Dämmerung/ungleichmäßig beleuchteten Fotos gefunden; breite Schattenbänder (Fensterreihen im Schatten) werden anhand der
   erkannten Fensterspalten in Einzelrechtecke zerlegt. Hauskanten kommen aus Kanten- + Fassadenfarben-Spaltenprofil, Ober-/Unterkante des Gebäudes aus den stärksten
   horizontalen Kanten (damit bleiben Bäume über dem Haus und Garten unten außen vor), Fassaden- und Dachfarbe aus den
   mittleren 60 % der Hausbreite (dritte Dachband-Zeilen), Gebäudehöhe unten aus dem letzten Inhalts-Zeilenblock. Beim
   Zusammenfähren von Komponenten wird die Breite begrenzt, damit Fenster nicht zu einem Riesen-Rechteck verschmelzen.
   Alle Werte sind per Regler nachträglich anpassbar; Vorschau zeigt die entstehende Grafik.
3. **OSM-Abgleich**: Liegt EXIF-GPS vor, wird das nächstgelegene OSM-Gebäude in `geodata.js` gesucht —
   per Klick übernimmt das Modul dessen **Ausrichtung** (Winkel der längsten Kante) und optional
   **Grundriss + Maße**.
4. **Platzieren**: „➜ In der 2D-Karte platzieren“ wechselt zum Spiel (`index.html?edit=1&mode=2d`):
   Maus = Position, **Q/E = drehen** (5°, mit Shift 1°), **Enter = speichern**, **Esc = abbrechen**.
   Ein Ghost zeigt live den Abstand zur Straße (grün ≥ 0,5 px, sonst rot).
5. Gespeicherte Gebäude liegen im **localStorage** (`fve_edits`) und werden beim Spielstart automatisch
   geladen (2D-Dachfarbe + 3D-Fassade mit eigener Textur via `js/facade.js`). Im Editor lassen sie sich
   auflisten, löschen, neu platzieren und als **JSON exportieren/importieren** (z. B. `custom_buildings.json`
   fürs Repo). Eigene Gebäude unterliegen denselben Regeln wie OSM-Gebäude (nie auf Wegen, Kollision etc.).

Dateien: `editor.html`, `js/editor.js`, `js/facade.js`.

Robustheit: Start- und Render-Fehler werden nicht mehr als schwarzer Bildschirm angezeigt,
sondern als rote Fehlermeldung auf dem Canvas (Init-Fehler) bzw. Fehler-Banner im Loop.
Der Platzier-Modus ist per try/catch abgesichert (bei Fehler zurück ins normale Spiel) und
 akzeptiert nur valide Pending-Daten. In der 2D-Karte zeigt ein **Hover über ein eigenes Gebäude**
eine Vorschau-Karte mit der erkannten Ansicht (Dachform, Fenster, Türen an ihren Positionen).
Die Analyse arbeitet **zeilenweise mit Hintergrund-Mode** (pro Bildzeile wird die häufigste Farbe als Hintergrund/Haus
ermittelt) — dadurch funktionieren auch **eng zugeschnittene Fotos ohne Himmel/Straße** (Gebäude füllt das Bild).
Gebäudetop/Unterkante kommen aus dem Breitenprofil, die Traufe aus dem stärksten Farbwechsel zur Fassadenfarbe,
Gebäudekanten aus dem Fassaden-Spaltenprofil. Dachfarbe = Zeilen-Mode des Dachbands, Fassadenfarbe = Pixel nahe der
Fassadenfarbe. Tür = Komponente, die die Fassaden-Unterkante erreicht.
Die Analyse erkennt Fenster/Türen als helle **und** dunkle Flächen (verglichen mit der
Fassaden-Helligkeit), mergt nur Komponenten derselben Reihe und fällt bei Fehlern auf
sichere Standardwerte zurück.

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
