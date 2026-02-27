/**
 * Weather module – fetches hourly forecast from Open-Meteo and renders
 * 3 weather cards (now + next 2 hours). City lookup via Nominatim.
 */
const Weather = (() => {
  // WMO weather code → emoji + description
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

  function decodeWeather(code) {
    return WMO_CODES[code] || ['&#127777;&#65039;', 'Unknown'];
  }

  async function fetchHourly(lat, lon, unit) {
    const tempUnit = unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,weathercode&temperature_unit=${tempUnit}&forecast_days=2`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
    return res.json();
  }

  /**
   * Search for cities using OpenStreetMap Nominatim.
   * Returns an array of { display_name, lat, lon }.
   */
  async function searchCity(query) {
    if (!query || query.length < 2) return [];
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
      `&format=json&limit=5&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
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
    // times are ISO strings like "2026-02-27T13:00"
    // Find the latest time that is <= now
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

  function formatHourLabel(isoTime, offset) {
    if (offset === 0) return 'Now';
    const d = new Date(isoTime);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function render(data, settings) {
    const hourly = data.hourly;
    const startIdx = findCurrentHourIndex(hourly.time);
    const unitLabel = settings.tempUnit === 'fahrenheit' ? 'F' : 'C';

    for (let i = 0; i < 3; i++) {
      const hi = startIdx + i;
      if (hi >= hourly.time.length) break;

      const card = document.getElementById(`weather-${i}`);
      if (!card) continue;

      const temp = Math.round(hourly.temperature_2m[hi]);
      const code = hourly.weathercode[hi];
      const [iconHtml, desc] = decodeWeather(code);
      const timeLabel = formatHourLabel(hourly.time[hi], i);

      card.querySelector('.weather-time').textContent = timeLabel;
      card.querySelector('.weather-icon').innerHTML = iconHtml;
      card.querySelector('.weather-temp').textContent = `${temp}\u00B0${unitLabel}`;
      card.querySelector('.weather-desc').textContent = desc;
    }

    const locationEl = document.getElementById('weather-location-label');
    if (locationEl) {
      locationEl.textContent = settings.city || `${settings.lat}, ${settings.lon}`;
    }
  }

  function renderEmpty(message) {
    for (let i = 0; i < 3; i++) {
      const card = document.getElementById(`weather-${i}`);
      if (!card) continue;
      card.querySelector('.weather-time').textContent = '';
      card.querySelector('.weather-icon').innerHTML = '';
      card.querySelector('.weather-temp').textContent = '';
      card.querySelector('.weather-desc').textContent = i === 0 ? message : '';
    }
    const locationEl = document.getElementById('weather-location-label');
    if (locationEl) locationEl.textContent = '';
  }

  async function update(settings) {
    if (!settings.lat || !settings.lon) {
      renderEmpty('Set location in settings');
      return;
    }
    try {
      const data = await fetchHourly(settings.lat, settings.lon, settings.tempUnit);
      render(data, settings);
    } catch (err) {
      console.error('Weather fetch failed:', err);
      renderEmpty('Unable to load');
    }
  }

  return { update, searchCity };
})();
