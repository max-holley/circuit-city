# Circuit City

A static, offline-capable educational circuit puzzle game for ages 6–12.

## Run

Deploy this folder to any static host (GitHub Pages, Cloudflare Pages, Netlify static hosting, etc.). No build step or backend is required.

For local development, serve the folder from a local static HTTP server. PWA/service-worker features require an HTTP(S) origin rather than `file://`.

## Architecture

- `js/engine.js` — reusable circuit graph/net analysis, diagnostics, short-circuit checks and series/parallel classification.
- `js/levels.js` — data-driven buildings, 16 levels, objectives, hints, achievements and avatars.
- `js/workbench.js` — touch/mouse/keyboard circuit editor and visualisation.
- `js/storage.js` — versioned local save, JSON import/export and sanitisation.
- `js/app.js` — city progression, rewards, screens, settings and Free Build Lab.
- `sw.js` / `manifest.webmanifest` — installable offline PWA shell.

## Simulation model

Circuit City intentionally uses a simplified but internally consistent model:

- Batteries are voltage sources and are not treated as conductive links between their own terminals.
- Wires, closed switches and conductive material samples form conductive connections.
- Bulbs, motors, buzzers and resistors are two-terminal loads.
- A device is powered only when it lies on a complete path between the battery terminals.
- A direct conductive path between battery terminals that bypasses loads is treated as a short circuit and invalidates the build.
- Series/parallel objectives are determined from circuit topology, not from where parts are drawn on screen.

The game avoids pretending to be an engineering-grade analogue simulator. Voltage and resistance are introduced conceptually and through component selection rather than inaccurate pseudo-calculations.
