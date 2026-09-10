/**
 * CARTO Basemaps & Leaflet Tile Providers Configuration
 * CARTO Key documentation:
 * https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=YOUR_KEY
 * Subdomains: 'abcd', maxZoom: 20
 */

export const CARTO_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CARTO_API_KEY) ||
  'cb1_3fnj_1_027cf5d07f9822554bf43632';

export const CARTO_VOYAGER_URL = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;
export const CARTO_POSITRON_URL = `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;
export const CARTO_DARK_MATTER_URL = `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;

export const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const ESRI_SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const ESRI_STREETS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
export const ESRI_TOPO_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
export const ESRI_DARK_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

export const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>';
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const ESRI_ATTRIBUTION = '&copy; Esri, Maxar, Earthstar Geographics';

export const BASEMAP_DEFINITIONS = {
  voyager: {
    id: 'voyager',
    name: 'Carto Voyager (HD)',
    url: CARTO_VOYAGER_URL,
    fallbackUrl: OSM_URL,
    attribution: CARTO_ATTRIBUTION,
    subdomains: 'abcd',
    maxZoom: 20,
    maxNativeZoom: 19,
  },
  positron: {
    id: 'positron',
    name: 'Carto Light',
    url: CARTO_POSITRON_URL,
    fallbackUrl: OSM_URL,
    attribution: CARTO_ATTRIBUTION,
    subdomains: 'abcd',
    maxZoom: 20,
    maxNativeZoom: 19,
  },
  streets: {
    id: 'streets',
    name: 'Streets',
    url: ESRI_STREETS_URL,
    fallbackUrl: CARTO_VOYAGER_URL,
    attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 19,
    maxNativeZoom: 16,
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    url: ESRI_SATELLITE_URL,
    fallbackUrl: CARTO_VOYAGER_URL,
    attribution: ESRI_ATTRIBUTION,
    subdomains: 'abc',
    maxZoom: 19,
    maxNativeZoom: 17,
  },
  terrain: {
    id: 'terrain',
    name: 'Terrain',
    url: ESRI_TOPO_URL,
    fallbackUrl: CARTO_VOYAGER_URL,
    attribution: '&copy; Esri — World Topo Map',
    subdomains: 'abc',
    maxZoom: 19,
    maxNativeZoom: 16,
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    url: CARTO_DARK_MATTER_URL,
    fallbackUrl: ESRI_DARK_URL,
    attribution: CARTO_ATTRIBUTION,
    subdomains: 'abcd',
    maxZoom: 20,
    maxNativeZoom: 19,
  },
};
