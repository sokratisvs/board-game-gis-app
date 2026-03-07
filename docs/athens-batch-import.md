# Athens Center Routes – Batch Import

## File

- **`client/public/athens-center-routes-batch.json`** – Array of 17 exploration routes (history & culture) around the center of Athens.

## Contents

- **Single-clue routes (1 checkpoint):** Tomb of the Unknown Soldier (Syntagma), Plaka, Temple of Olympian Zeus, Monastiraki, Ancient Agora, Kerameikos, Tower of the Winds, Lysikrates Monument, Zappeion, Panathenaic Stadium (Kallimarmaro).
- **Two-clue routes (2 checkpoints):** Syntagma → Plaka; Agora + Stoa of Attalos; Hadrian’s Gate → Temple of Zeus; Roman Agora → Tower of the Winds.
- **Three-clue routes (3 checkpoints):** Acropolis Three Landmarks (Acropolis view → Parthenon → Areopagus); Three Hills (Acropolis → Areopagus → Pnyx); Temple of Zeus → Zappeion → Kallimarmaro.

Each checkpoint uses `quiz.question` as the clue text (history/culture) and includes `coordinates`, optional `validationRadiusMeters`, and multiple-choice `quiz` for the app/DB.

## How to import in the React app

1. Open **Quiz routes** (Exploration routes) in the app.
2. **Create route** → **Import JSON**.
3. Paste the **entire contents** of `athens-center-routes-batch.json` (the array).  
   The app accepts either a **single route object** or an **array of route objects**; for an array it creates one route per element and applies each to the DB via `POST /api/exploration/routes/from-batch`.
4. Click **Import and create route(s)**. All 17 routes will be created in sequence; you’ll be taken to the edit page of the last created route.

Alternatively, copy one route object from the array and paste it to import that route only.
