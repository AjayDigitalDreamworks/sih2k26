async function test() {
  const t0 = Date.now();
  console.log('Sending request to ML service...');
  try {
    const res = await fetch('http://localhost:8010/route/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originDistrictId: 'kamrup',
        destDistrictId: 'east_khasi',
        vehicleType: 'heavy_truck',
        cargoWeightKg: 15000,
        prefer: 'safest'
      })
    });
    const data = await res.json();
    console.log('Completed in', Date.now() - t0, 'ms');
    console.log('Success:', data.success);
    console.log('Alternatives count:', data.alternatives?.length);
    if (data.recommended) {
      console.log('Recommended distance:', data.recommended.totalDistanceKm, 'km');
      console.log('Recommended fuel:', data.recommended.estimatedFuelLiters, 'L');
      console.log('Recommended risk:', data.recommended.riskScore);
      console.log('Legs count:', data.recommended.legs?.length);
      console.log('Geometry points:', data.recommended.geometry?.length);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
