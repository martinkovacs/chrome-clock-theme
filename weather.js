/**
 * Weather module – fetches current weather from Open-Meteo API.
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

  async function fetchWeather(lat, lon, unit) {
    const tempUnit = unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true&temperature_unit=${tempUnit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
    return res.json();
  }

  function render(data, settings) {
    const cw = data.current_weather;
    const [iconHtml, desc] = decodeWeather(cw.weathercode);
    const unitLabel = settings.tempUnit === 'fahrenheit' ? 'F' : 'C';

    document.getElementById('weather-icon').innerHTML = iconHtml;
    document.getElementById('weather-temp').textContent =
      `${Math.round(cw.temperature)}\u00B0${unitLabel}`;
    document.getElementById('weather-desc').textContent = desc;
    document.getElementById('weather-location-label').textContent =
      settings.city || `${settings.lat}, ${settings.lon}`;
  }

  async function update(settings) {
    if (!settings.lat || !settings.lon) {
      document.getElementById('weather-desc').textContent =
        'Set location in settings';
      return;
    }
    try {
      const data = await fetchWeather(settings.lat, settings.lon, settings.tempUnit);
      render(data, settings);
    } catch (err) {
      console.error('Weather fetch failed:', err);
      document.getElementById('weather-desc').textContent = 'Unable to load';
    }
  }

  return { update };
})();
