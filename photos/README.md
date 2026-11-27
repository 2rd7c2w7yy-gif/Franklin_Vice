# Referenz-Fotos aus Franklin (werden NICHT im Spiel angezeigt)

Fotos dienen ausschließlich als **Vorlage**, damit die Gebäude-Polygone in
`js/geodata.js` (Grundriss, Höhe, Dachform, Fassade) den echten Häusern
möglichst originalgetreu nachempfunden werden können. Im Spiel selbst werden
**keine Fotos gerendert**.

## Ablauf

1. Smartphone-Fotos (JPEG mit EXIF-GPS) hierher legen, z. B. `photos/IMG_001.jpg`
   (nur eigene / entsprechend lizenzierte Fotos — keine Street-View-Bilder)
2. `node tools/build_photos.js` ausführen: liest GPS + Aufnahmerichtung (EXIF),
   projiziert auf die OSM-Karte, matched das nächstgelegene Gebäude und schreibt
   das Referenz-Manifest `photos/photos.json` (welches Foto → welches Gebäude, Blickrichtung)
3. `photos/` committen/pushen — dann werden die Fotos analysiert und die
   passenden Gebäude-Polygone in `js/geodata.js` angepasst (Grundriss/Höhe/Dach/Fassade)
