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
];

export const districtById = (id) => DISTRICTS.find((d) => d.id === id) || null;

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
];
