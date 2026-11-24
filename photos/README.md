# Eigene Fotos aus Franklin

Lege hier JPEGs ab, die mit dem Handy in Franklin aufgenommen wurden
(mit GPS-EXIF-Daten — das ist bei Smartphone-Fotos standardmäßig an).

## Ablauf

1. Fotos hierher kopieren, z. B. `photos/IMG_001.jpg`
2. Generator laufen lassen (im Repo-Root, braucht nur Node.js, keine Pakete):

   ```bash
   node tools/build_photos.js
   ```

   Der liest die GPS-Koordinaten + Aufnahmerichtung aus dem EXIF, projiziert
   sie auf die OpenStreetMap-Karte des Spiels, ordnet jedes Foto dem
   nächstgelegenen Gebäude zu und schreibt `js/photodata.js` neu.
3. `photos/` + die neue `js/photodata.js` committen und pushen.

Im Spiel erscheinen die Fotos dann als Kamera-Marker auf Karte und Minimap,
als 3D-Billboard an der exakten GPS-Position (Blickrichtung aus EXIF) und als
großes Overlay, wenn du dich in der Nähe befindest.

Hinweis: Nur eigene Fotos verwenden (oder entsprechend lizenzierte) —
keine Street-View-/Drittanbieter-Bilder.
