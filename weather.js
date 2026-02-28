/**
 * Weather module – fetches hourly forecast from Open-Meteo for up to 3
 * locations. Each location shows current weather (large) plus the next
 * 3 hours. City lookup via Nominatim.
 */
const Weather = (() => {
  const WMO_CODES = {
    0: ['&#9728;&#65039;', 'Clear sky'],
    1: ['&#127780;&#65039;', 'Mainly clear'],
    2: ['&#9925;', 'Partly cloudy'],
    3: ['&#9729;&#65039;', 'Overcast'],
    45: ['&#127787;&#65039;', 'Foggy'],
    48: ['&#127787;&#65039;', 'Depositing rime fog'],
    51: ['&#127782;&#65039;', 'Light drizzle'],
    53: ['&#127782;&#65039;', 'Moderate drizzle'],
    55: ['&#127782;&#65039;', 'Dense drizzle'],
    56: ['&#127782;&#65039;', 'Freezing drizzle'],
    57: ['&#127782;&#65039;', 'Dense freezing drizzle'],
    61: ['&#127783;&#65039;', 'Slight rain'],
    63: ['&#127783;&#65039;', 'Moderate rain'],
    65: ['&#127783;&#65039;', 'Heavy rain'],
    66: ['&#127783;&#65039;', 'Freezing rain'],
    67: ['&#127783;&#65039;', 'Heavy freezing rain'],
    71: ['&#127784;&#65039;', 'Slight snow'],
    73: ['&#127784;&#65039;', 'Moderate snow'],
    75: ['&#127784;&#65039;', 'Heavy snow'],
    77: ['&#127784;&#65039;', 'Snow grains'],
    80: ['&#127782;&#65039;', 'Slight showers'],
    81: ['&#127782;&#65039;', 'Moderate showers'],
    82: ['&#127782;&#65039;', 'Violent showers'],
    85: ['&#127784;&#65039;', 'Slight snow showers'],
    86: ['&#127784;&#65039;', 'Heavy snow showers'],
    95: ['&#9889;', 'Thunderstorm'],
    96: ['&#9889;', 'Thunderstorm with hail'],
    99: ['&#9889;', 'Thunderstorm with heavy hail'],
  };

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function decodeWeather(code) {
    return WMO_CODES[code] || ['&#127777;&#65039;', 'Unknown'];
  }

  async function fetchHourly(lat, lon, unit) {
    const tempUnit = unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    const cacheKey = `weather_${lat},${lon},${tempUnit}`;

    // Check persistent cache (survives across new tabs)
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < CACHE_TTL) {
          return data;
        }
      }
    } catch (e) {}

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,weathercode&temperature_unit=${tempUnit}&forecast_days=2`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
    const data = await res.json();

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (e) {}

    return data;
  }

  async function searchCity(query) {
    if (!query || query.length < 2) return [];
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
      `&format=json&limit=5&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'hu-HU,hu;q=0.9,en;q=0.8' },
    });
    if (!res.ok) return [];
    const results = await res.json();
    return results.map((r) => ({
      display_name: r.display_name,
      name: r.address.city || r.address.town || r.address.village || r.name,
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
    }));
  }

  function findCurrentHourIndex(times) {
    const now = new Date();
    let idx = 0;
    for (let i = 0; i < times.length; i++) {
      if (new Date(times[i]) <= now) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }

  function formatHour(isoTime) {
    const d = new Date(isoTime);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  /**
   * Build the DOM for one location block.
   */
  function buildLocationBlock(loc, data, unitLabel) {
    const hourly = data.hourly;
    const startIdx = findCurrentHourIndex(hourly.time);

    const block = document.createElement('div');
    block.className = 'weather-location';

    // City label
    const cityEl = document.createElement('div');
    cityEl.className = 'weather-city';
    cityEl.textContent = loc.city;
    block.appendChild(cityEl);

    // Current weather (large)
    const currentTemp = Math.round(hourly.temperature_2m[startIdx]);
    const currentCode = hourly.weathercode[startIdx];
    const [currentIcon, currentDesc] = decodeWeather(currentCode);

    const currentEl = document.createElement('div');
    currentEl.className = 'weather-current';
    currentEl.innerHTML =
      `<div class="weather-current-icon">${currentIcon}</div>` +
      `<div class="weather-current-info">` +
      `<div class="weather-current-temp">${currentTemp}\u00B0${unitLabel}</div>` +
      `<div class="weather-current-desc">${currentDesc}</div>` +
      `</div>`;
    block.appendChild(currentEl);

    // Next 3 hours forecast
    const forecastEl = document.createElement('div');
    forecastEl.className = 'weather-forecast';

    for (let i = 1; i <= 3; i++) {
      const hi = startIdx + i;
      if (hi >= hourly.time.length) break;

      const temp = Math.round(hourly.temperature_2m[hi]);
      const code = hourly.weathercode[hi];
      const [icon] = decodeWeather(code);

      const hourEl = document.createElement('div');
      hourEl.className = 'weather-hour';
      hourEl.innerHTML =
        `<div class="weather-hour-time">${formatHour(hourly.time[hi])}</div>` +
        `<div class="weather-hour-icon">${icon}</div>` +
        `<div class="weather-hour-temp">${temp}\u00B0${unitLabel}</div>`;
      forecastEl.appendChild(hourEl);
    }

    block.appendChild(forecastEl);
    return block;
  }

  /**
   * Update all weather widgets.
   * @param {object} settings – full settings object with `locations` array and `tempUnit`.
   */
  async function update(settings) {
    const container = document.getElementById('weather-container');
    container.innerHTML = '';

    const locations = settings.locations || [];
    if (locations.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'weather-location weather-empty';
      msg.innerHTML = '<div class="weather-current-desc">Set location in settings</div>';
      container.appendChild(msg);
      return;
    }

    const unitLabel = settings.tempUnit === 'fahrenheit' ? 'F' : 'C';

    // Fetch all locations in parallel
    const fetches = locations.map((loc) =>
      fetchHourly(loc.lat, loc.lon, settings.tempUnit)
        .then((data) => ({ loc, data, error: false }))
        .catch(() => ({ loc, data: null, error: true }))
    );

    const results = await Promise.all(fetches);

    results.forEach(({ loc, data, error }) => {
      if (error || !data) {
        const block = document.createElement('div');
        block.className = 'weather-location';
        block.innerHTML =
          `<div class="weather-city">${loc.city}</div>` +
          `<div class="weather-current"><div class="weather-current-desc">Unable to load</div></div>`;
        container.appendChild(block);
        return;
      }
      container.appendChild(buildLocationBlock(loc, data, unitLabel));
    });
  }

  /**
   * Resolve IANA timezone from coordinates via Open-Meteo.
   */
  async function resolveTimezone(lat, lon) {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&timezone=auto&forecast_days=1&hourly=temperature_2m`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.timezone || null;
    } catch {
      return null;
    }
  }

  return { update, searchCity, resolveTimezone };
})();
