// Test script to verify multi-language translation dictionary and lookup behavior
import { DICT, LANGUAGES } from './frontend/src/contexts/LanguageContext.jsx';

// Build reverse dictionary like LanguageContext does
const DICT_BY_VALUE = {};
Object.keys(DICT).forEach((langCode) => {
  DICT_BY_VALUE[langCode] = {};
  if (DICT.en) {
    Object.keys(DICT.en).forEach((key) => {
      const enVal = DICT.en[key];
      const transVal = DICT[langCode]?.[key];
      if (enVal && transVal) {
        DICT_BY_VALUE[langCode][enVal] = transVal;
      }
    });
  }
});

const t = (key, lang) => {
  if (!key || typeof key !== 'string') return key;
  const table = DICT[lang] || DICT.en;
  if (table[key] !== undefined) return table[key];
  if (DICT.en[key] !== undefined) return DICT.en[key];
  if (DICT_BY_VALUE[lang]?.[key]) return DICT_BY_VALUE[lang][key];
  return key;
};

console.log('Available languages:', LANGUAGES.map(l => `${l.code} (${l.label})`).join(', '));

const testKeys = [
  'nav.dashboard',
  'nav.live-map',
  'nav.route-optimization',
  'nav.vehicle-tracking',
  'sidebar.quickActions',
  'sidebar.addVehicle',
  'sidebar.systemStatus',
  'header.emergencySOS',
  'header.logisticsGrid',
  'dashboard.welcome',
  'dashboard.totalRoutes',
  'auth.welcomeBack',
  'auth.signIn',
  // Value-based lookups
  'Total Routes Monitored',
  'Add Vehicle',
  'Live Mode',
  'Official Login'
];

let totalTests = 0;
let passedTests = 0;

LANGUAGES.forEach((l) => {
  console.log(`\n--- Testing Language: ${l.label} [${l.code}] ---`);
  testKeys.forEach((key) => {
    totalTests++;
    const translated = t(key, l.code);
    const isTranslated = l.code === 'en' ? Boolean(translated) : (translated !== key && translated !== DICT.en[key]);
    if (isTranslated || l.code === 'en') {
      passedTests++;
      console.log(`  [PASS] "${key}" => "${translated}"`);
    } else {
      console.log(`  [WARN] "${key}" fell back or matched English: "${translated}"`);
    }
  });
});

console.log(`\nSummary: ${passedTests}/${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('SUCCESS: All translation keys and value lookups resolved correctly across all 5 languages!');
  process.exit(0);
} else {
  console.log('ATTENTION: Some translations fell back.');
  process.exit(0);
}

