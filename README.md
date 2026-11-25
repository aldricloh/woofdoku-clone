# Woofdoku

A cozy dog logic puzzle, inspired by Meowdoku. Give every pup its own patch of the park:

- exactly **one dog in every row, column and coloured region**
- **no two dogs may touch**, not even diagonally

Tap a square once for an X, again for a dog, again to clear. Drag across squares to mark many X's at once.

## Features

- 40 hand-ordered levels growing from 5×5 to 9×9, plus endless random puzzles (Easy 6×6 to Expert 9×9)
- Every puzzle is generated with a guaranteed unique solution, so it can always be solved by logic alone
- Conflict highlighting, sound effects, vibration (Android) and a win celebration
- Progress saved on the device
- Installable progressive web app that works offline

## Project layout

```
index.html             page markup and the dog SVG
css/styles.css         all styles (light and dark themes)
js/engine.js           seeded puzzle generator and solver
js/game.js             UI, touch input, sound, saves, install prompt
sw.js                  service worker (offline support)
manifest.webmanifest   app name, colours and icons
icons/                 app icon (SVG master + PNG sizes)
vercel.json            headers for the service worker and manifest
tests/engine.test.js   checks every puzzle has exactly one solution
```

No build step and no dependencies: it's plain HTML, CSS and JavaScript.

## Run locally

Service workers need `localhost` or HTTPS, so serve the folder rather than opening the file:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Run the puzzle tests with Node:

```sh
node tests/engine.test.js
```

## Deploy to Vercel

1. In Vercel, choose **Add New → Project** and import this GitHub repo.
2. Leave **Framework Preset** as **Other**, with no build command and the root directory as the output.
3. Deploy. Every push to `main` redeploys automatically.

Or from the command line: `npx vercel --prod`.

## Install on your phone

Open the deployed site, then:

- **Android (Chrome):** tap the download button in the header (or the browser menu → **Install app**).
- **iPhone (Safari):** tap **Share → Add to Home Screen**.

When you change the files the service worker caches, bump `VERSION` in `sw.js` so installed copies refresh their offline cache.
