# Custom Clock & Weather — Chrome New Tab

A Chrome extension that replaces the new tab page with a customizable clock, date display, and live weather widget.

## Features

- **Clock** — Large, centered clock with seconds. Configurable format (12h / 24h), font, size, color, and toggle for seconds display.
- **Date** — Shown below the clock. Supports long, short, and ISO formats.
- **Weather widget** — Top-left corner. Fetches current conditions from the [Open-Meteo API](https://open-meteo.com/) (no API key required). Displays temperature, weather description, and an emoji icon based on WMO weather codes. Refreshes every 15 minutes.
- **Background images** — Drop images into the `backgrounds/` folder and they are picked up automatically. Three modes:
  - **Automatic** — a random image is chosen on every new tab
  - **Pick** — select a specific image from a thumbnail grid in settings
  - **Solid color** — plain color fallback
- **Settings panel** — Accessible via the gear icon in the bottom-right corner.

## Installation

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (toggle in the top-right).
4. Click **Load unpacked** and select this folder.
5. Open a new tab to see it in action.

## Adding background images

1. Place your image files (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`, `.svg`) into the `backgrounds/` folder.
2. Go to `chrome://extensions`, find this extension, and click the refresh icon (or press the **Update** button at the top).
3. Open a new tab — your images will appear in the background picker and in automatic rotation.

No configuration file needed. Every image file in `backgrounds/` is detected automatically.

## Configuring weather

1. Click the gear icon on the new tab page.
2. Under **Weather & Location**, either:
   - Click **Use my current location** to auto-fill coordinates, or
   - Enter latitude, longitude, and a city name manually.
3. Choose your preferred temperature unit (Celsius / Fahrenheit).
4. Click **Save**.

## Project structure

```
├── manifest.json       # Chrome extension manifest (MV3)
├── newtab.html         # New tab page
├── styles.css          # Styling
├── app.js              # Entry point — wires modules together
├── clock.js            # Clock & date rendering
├── weather.js          # Open-Meteo weather fetching & display
├── background.js       # Background image discovery & application
├── settings.js         # Settings panel UI & chrome.storage persistence
├── backgrounds/        # Drop your wallpaper images here
└── icons/
    └── icon128.png     # Extension icon
```

## License

MIT
