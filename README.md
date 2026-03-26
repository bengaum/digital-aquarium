README – Digital Aquarium (Offline)

    /* =========================================================
       DIGITALES AQUARIUM copyright by Ben Gaum
       Bernhard.gaum@unternehmensberatung-gaum.de
       https://www.unternehmensberatung-gaum.de
       https://www.linktr.ee/ben_gaum
    ========================================================= */

Version: Responsive + Clean‑Fullscreen + Tierverwaltung (Studio • Aquarium • Design)
Datei: Single‑File HTML (läuft lokal im Browser)

1) Kurzbeschreibung
Digital Aquarium ist eine offlinefähige, browserbasierte Single‑File‑App, mit der eigene Fotos (z. B. Tiere, Figuren, Zeichnungen) in wenigen Schritten freigestellt und als „schwimmende“ Objekte in ein animiertes Aquarium eingesetzt werden können.
Neben dem Aquarium‑Modus gibt es ein Studio zum Import/Background‑Removal sowie einen Design‑Modus zum Gestalten des Hintergrunds und zum Platzieren von Deko‑Assets. Für Präsentationen/Events unterstützt die App einen Clean‑Fullscreen, bei dem im Vollbild alle Menüs ausgeblendet werden, sodass nur das Aquarium sichtbar bleibt.

2) Features
Studio (Import & Freistellen)

Bildimport per:

Datei auswählen (Upload)
Kamera (falls vom Gerät/Browser unterstützt)
Drag & Drop


Freistell‑Modi:

Rand‑Region (empfohlen): entfernt Hintergrund, der mit dem Rand verbunden ist
Weiß‑Hintergrund (Schwelle)
Pipette (Hintergrundfarbe picken)
Chromakey (grün/blau)


Qualitätsparameter:

Toleranz/Schwellwert
Kanten‑Weichzeichnung
Auto‑Zuschnitt


Spawn‑Parameter pro Tier:

Größe
Geschwindigkeit
Kopfseite (Bildausrichtung)



Aquarium (Animation & Interaktion)

Animiertes Aquarium mit:

Blasen‑/Effekt‑Dichte
Licht‑/Hintergrundeffekten (abhängig vom Design)


Steuerung:

Gesamtgeschwindigkeit
Tiergröße (globaler Scale)
Effekte


Interaktionen:

Füttern (Food‑Partikel)
Screenshot (PNG Export)
Tierliste / Verwaltung (🐟 Liste)

Name setzen
Größe/Geschwindigkeit pro Tier
„Name dauerhaft“
„Name zeigen“ (👁) als Toggle (Ein/Aus, inkl. optionalem Fade)





Design (Hintergrund & Assets)

Theme‑Hintergründe oder eigenes Hintergrundbild
Licht/Vignette/Füllmodus
Platzierbare Deko‑Assets (Emoji‑Set + eigene Bilder)

Präsentation / Vollbild (Clean UI)

Vollbildmodus blendet konsequent alle Menüs/Overlays aus → nur Aquarium sichtbar
Optionaler Präsentationsmodus, der auch bei Browser‑Fullscreen (z. B. F11) die UI ausblenden kann (je nach Build)

Responsive / Mobile‑Friendly

Optimierte Lesbarkeit und Bedienbarkeit auf Smartphone/Tablet:

Buttons mit Touch‑Größe (≥ 44px)
UI‑Wrap & Stacking bei kleinen Viewports
bessere Slider‑Bedienbarkeit
Layout‑Anpassungen für Portrait/Rotation




3) Systemanforderungen

Moderner Browser: Edge / Chrome / Firefox / Safari
Keine Installation nötig (Single‑HTML lokal öffnen)
Optional: Kamera‑Zugriff (Browser/OS‑abhängig)


4) Schnellstart


HTML-Datei lokal öffnen
Doppelklick auf die Datei (oder via Browser „Datei öffnen“).


Studio → Bild importieren

Ziehe ein Bild in die Drop‑Zone oder nutze „Datei hochladen“ / „Fotografieren“.



Freistellen

Standard: Rand‑Region (empfohlen)
Klicke „✨ Freistellen“
Bei Bedarf Toleranz/Kanten anpassen und erneut freistellen.



Ins Aquarium senden

Optional: Tiername setzen
Klicke „🚀 Ins Aquarium senden“



Aquarium steuern / präsentieren

Regler anpassen, Füttern, Screenshot
⛶ Vollbild für Clean‑Präsentation




5) Bedienkonzept (Kurz)
Tabs

Studio: Import & Freistellen
Aquarium: Live‑Ansicht, Animation, Steuerung
Aquarium Design: Hintergrund/Assets

Tierverwaltung (🐟 Liste)

Öffnet Verwaltungspanel mit pro‑Tier Einstellungen
Name dauerhaft: Name permanent sichtbar
👁 Name zeigen: Toggle (Ein/Aus) – wenn „dauerhaft“ deaktiviert


6) Tipps für beste Ergebnisse

Heller, ruhiger Hintergrund beim Fotografieren
Motiv möglichst zentriert und scharf
Für schwierige Hintergründe:

Pipette oder Chromakey nutzen
Toleranz schrittweise erhöhen
Kanten‑Weichzeichnung moderat (z. B. 1–3 px)




7) Bekannte Browser‑Hinweise

Kamera‑Button kann je nach Gerät/Browser statt Kamera einen Dateidialog öffnen (OS‑Policy).
„Autoplay“: Sound (falls aktiviert) startet aus Browser‑Gründen nur nach Nutzerinteraktion (Klick/Tap).
„Fullscreen“: DOM‑Fullscreen (via Button) unterscheidet sich von Browser‑Fullscreen (F11). Für „UI‑weg“ in F11 ggf. Präsentationsmodus nutzen (falls enthalten).


8) Datenschutz

Die App läuft lokal im Browser.
Bilder werden für die Bearbeitung im Browser verarbeitet (Canvas/Web APIs).
Es findet keine serverseitige Verarbeitung statt (sofern die Datei lokal genutzt wird).


9) Lizenz / Nutzung

Interne/Private Nutzung: frei 



10) Roadmap (optional)

Sound‑Profile (Rauschen/Blubbern/Geplätscher) + Lautstärke‑Regler
Aquarium‑Export/Import (Persistenz)
PWA‑Offline‑Install (Home‑Screen, Cache)
Kiosk‑Timer (Auto‑Fullscreen nach Inaktivität)
Mehrsprachigkeit (DE/EN Umschalter)
