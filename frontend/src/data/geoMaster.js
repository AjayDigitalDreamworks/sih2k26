// Real NER district geo master — mirrors the seeded District rows on the backend.
// Used for consignments, delivery history maps, live-tracking corridors and route planning.
export const DISTRICTS = [
  { id: 'kamrup', name: 'Kamrup', city: 'Guwahati', label: 'Kamrup (Guwahati)', state: 'Assam', lat: 26.1445, lng: 91.7362 },
  { id: 'sonitpur', name: 'Sonitpur', city: 'Tezpur', label: 'Sonitpur (Tezpur)', state: 'Assam', lat: 26.6528, lng: 92.7926 },
  { id: 'cachar', name: 'Cachar', city: 'Silchar', label: 'Cachar (Silchar)', state: 'Assam', lat: 24.817, lng: 92.7985 },
  { id: 'dima_hasao', name: 'Dima Hasao', city: 'Haflong', label: 'Dima Hasao (Haflong)', state: 'Assam', lat: 25.1764, lng: 93.0232 },
  { id: 'east_khasi', name: 'East Khasi Hills', city: 'Shillong', label: 'East Khasi Hills (Shillong)', state: 'Meghalaya', lat: 25.5788, lng: 91.8933 },
  { id: 'west_khasi', name: 'West Khasi Hills', city: 'Nongstoin', label: 'West Khasi Hills (Nongstoin)', state: 'Meghalaya', lat: 25.5244, lng: 91.2662 },
  { id: 'dimapur', name: 'Dimapur', city: 'Dimapur', label: 'Dimapur', state: 'Nagaland', lat: 25.906, lng: 93.727 },
  { id: 'kohima', name: 'Kohima', city: 'Kohima', label: 'Kohima', state: 'Nagaland', lat: 25.6751, lng: 94.1086 },
  { id: 'imphal_west', name: 'Imphal West', city: 'Imphal', label: 'Imphal West', state: 'Manipur', lat: 24.817, lng: 93.9368 },
  { id: 'aizawl', name: 'Aizawl', city: 'Aizawl', label: 'Aizawl', state: 'Mizoram', lat: 23.7271, lng: 92.7176 },
  { id: 'papum_pare', name: 'Papum Pare', city: 'Itanagar', label: 'Papum Pare (Itanagar)', state: 'Arunachal Pradesh', lat: 27.0844, lng: 93.6053 },
  { id: 'west_tripura', name: 'West Tripura', city: 'Agartala', label: 'West Tripura (Agartala)', state: 'Tripura', lat: 23.8315, lng: 91.2868 },
  // Faridabad (Haryana) hubs
  { id: 'ajay_digital_dreamworks', name: 'Ajay Digital Dreamworks', city: 'Faridabad', label: 'Ajay Digital Dreamworks (Dabua, Faridabad)', state: 'Haryana', lat: 28.3820, lng: 77.2800 },
  { id: 'dabua_chowk', name: 'Dabua Chowk', city: 'Faridabad', label: 'Dabua Chowk (NIT Faridabad)', state: 'Haryana', lat: 28.3842, lng: 77.2878 },
  { id: 'dabua_colony', name: 'Dabua Colony', city: 'Faridabad', label: 'Dabua Colony (NIT Faridabad)', state: 'Haryana', lat: 28.3838, lng: 77.2817 },
  { id: 'aravali_college', name: 'Aravali College of Engineering & Management', city: 'Faridabad', label: 'Aravali College of Engg & Mgmt (Jasana, Faridabad)', state: 'Haryana', lat: 28.4006, lng: 77.4125 },
];

export const districtById = (id) => DISTRICTS.find((d) => d.id === id) || null;

export const findDistrictMatch = (term) => {
  if (!term) return null;
  const clean = String(term).trim().toLowerCase();
  // Exact id match
  let match = DISTRICTS.find((d) => d.id.toLowerCase() === clean);
  if (match) return match;
  // Exact city match
  match = DISTRICTS.find((d) => d.city && d.city.toLowerCase() === clean);
  if (match) return match;
  // Exact name match
  match = DISTRICTS.find((d) => d.name && d.name.toLowerCase() === clean);
  if (match) return match;
  // Substring or label match
  match = DISTRICTS.find((d) =>
    (d.label && d.label.toLowerCase().includes(clean)) ||
    (d.city && d.city.toLowerCase().includes(clean)) ||
    (d.name && d.name.toLowerCase().includes(clean)) ||
    clean.includes(d.id.toLowerCase()) ||
    (d.city && clean.includes(d.city.toLowerCase())) ||
    (d.name && clean.includes(d.name.toLowerCase()))
  );
  return match || null;
};

export const districtLabel = (id) => {
  const d = districtById(id);
  return d ? d.label : (id || '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export const districtState = (id) => {
  const d = districtById(id);
  return d ? d.state : '';
};

// Real corridor routes (matches the seeded Route rows).
export const CORRIDORS = [
  { id: 'R-01', name: 'Guwahati → Tezpur', originDistrictId: 'kamrup', destDistrictId: 'sonitpur', highway: 'NH-27 / NH-37' },
  { id: 'R-02', name: 'Guwahati → Shillong', originDistrictId: 'kamrup', destDistrictId: 'east_khasi', highway: 'NH-6' },
  { id: 'R-03', name: 'Silchar → Aizawl', originDistrictId: 'cachar', destDistrictId: 'aizawl', highway: 'NH-306' },
  { id: 'R-04', name: 'Dimapur → Imphal', originDistrictId: 'dimapur', destDistrictId: 'imphal_west', highway: 'NH-2' },
  { id: 'R-05', name: 'Guwahati → Itanagar', originDistrictId: 'kamrup', destDistrictId: 'papum_pare', highway: 'NH-27 / NH-415' },
  { id: 'R-FBD-01', name: 'Ajay Digital Dreamworks → Aravali College', originDistrictId: 'ajay_digital_dreamworks', destDistrictId: 'aravali_college', highway: 'Faridabad Bypass / Jasana Rd' },
  { id: 'R-FBD-02', name: 'Dabua Chowk → Aravali College', originDistrictId: 'dabua_chowk', destDistrictId: 'aravali_college', highway: 'BPTP / Jasana Rd' },
  { id: 'R-FBD-03', name: 'Dabua Colony → Dabua Chowk', originDistrictId: 'dabua_colony', destDistrictId: 'dabua_chowk', highway: 'Sohna Rd / Dabua Rd' },
  { id: 'R-FBD-04', name: 'Ajay Digital Dreamworks → Dabua Chowk', originDistrictId: 'ajay_digital_dreamworks', destDistrictId: 'dabua_chowk', highway: 'Dabua Main Rd' },
];
