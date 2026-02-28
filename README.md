# Custom Clock & Weather — Chrome New Tab

A Chrome extension that replaces the new tab page with a customizable clock, date display, world clocks, and live weather widgets.

## Features

- **Clock** — Large, centered clock. Configurable format (12h / 24h), font family, font weight, size, color, and seconds toggle.
- **Custom fonts** — Choose from built-in fonts or load any Google Font by name.
- **Date** — Shown below the clock. Supports long, short, and ISO formats.
- **World clocks** — Up to 3 additional clocks in the top-right corner, each showing the time in a different city/timezone.
- **Weather widgets** — Top-left corner, up to 3 locations. Fetches current conditions and a 3-hour forecast from the [Open-Meteo API](https://open-meteo.com/) (no API key required). Displays temperature, description, and emoji icons. Refreshes every 5 minutes.
- **Background images** — Multiple modes:
  - **Automatic** — a random image from `backgrounds/` is chosen on every new tab
  - **Pick** — select a specific image from a thumbnail grid in settings
  - **Custom image** — pick any image file from your computer via a file dialog
  - **Custom folder** — select a folder of images; a random one is shown on each new tab
  - **Solid color** — plain color fallback
- **Thumbnails** — Place smaller versions of background images in `backgrounds/thumbnails/` for faster loading in the picker. Falls back to the full-size image if no thumbnail exists.
- **Settings panel** — Accessible via the gear icon in the bottom-right corner. All changes are saved automatically.

## Installation

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (toggle in the top-right).
4. Click **Load unpacked** and select this folder.
5. Open a new tab to see it in action.

## Adding background images

1. Place your image files (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`, `.svg`) into the `backgrounds/` folder.
2. Optionally add smaller thumbnail versions in `backgrounds/thumbnails/` with the same filenames.
3. Go to `chrome://extensions`, find this extension, and click the refresh icon (or press **Update**).
4. Open a new tab — your images will appear in the background picker and in automatic rotation.

No configuration file needed. Every image file in `backgrounds/` is detected automatically.

## Configuring weather

1. Click the gear icon on the new tab page.
2. Under **Weather & Location**, search for a city and select it. You can add up to 3 locations.
3. Choose your preferred temperature unit (Celsius / Fahrenheit).

## Configuring world clocks

1. Click the gear icon on the new tab page.
2. Under **World Clocks**, search for a city and select it. You can add up to 3 clocks.
3. Each clock displays the current time in that city's timezone.

## Project structure

```
├── manifest.json              # Chrome extension manifest (MV3)
├── newtab.html                # New tab page
├── styles.css                 # Styling
├── app.js                     # Entry point — wires modules together
├── clock.js                   # Clock, date, and world clocks rendering
├── weather.js                 # Open-Meteo weather fetching & display
├── background.js              # Background image discovery & application
├── settings.js                # Settings panel UI & chrome.storage persistence
├── backgrounds/               # Drop your wallpaper images here
│   └── thumbnails/            # Optional smaller versions for the picker
└── icons/
    └── icon128.png            # Extension icon
```

## License

MIT
