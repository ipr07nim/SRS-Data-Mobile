import { WEATHER } from '../config/app.config';

export interface WeatherSnapshot {
  temp: string;
  wind: string;
  humidity: string;
}

export const WEATHER_PLACEHOLDER: WeatherSnapshot = {
  temp: '--°F',
  wind: '-mph',
  humidity: '--%',
};

export const WEATHER_ERROR: WeatherSnapshot = {
  temp: 'Error',
  wind: 'N/A',
  humidity: 'N/A',
};

export function buildWeatherApiUrl(): string {
  return WEATHER.apiUrl
    .replace('{lat}', String(WEATHER.latitude))
    .replace('{lon}', String(WEATHER.longitude));
}

interface OpenMeteoCurrent {
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrent;
}

/** Parse Open-Meteo JSON into display strings (client-side fetch). */
export function parseWeatherResponse(data: unknown): WeatherSnapshot {
  const current = (data as OpenMeteoResponse)?.current;
  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('Invalid weather response');
  }
  return {
    temp: `${Math.round(current.temperature_2m)}°F`,
    wind: `${Math.round(current.wind_speed_10m)} mph`,
    humidity: `${current.relative_humidity_2m}%`,
  };
}
