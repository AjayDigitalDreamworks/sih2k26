/**
 * Resets the reference real-GPS fixture to a deterministic starting state.
 * Usage: npx tsx scripts/reset-tracking.ts   (from core-backend/)
 *
 * - Trip TRP-1001  -> status 'planned', no started/arrival times, 0% progress
 * - Vehicle AS-01-AB-1234 -> idle, tracking off, OFFLINE, no current trip
 * - Driver DRV-01 -> vehicle_id AS-01-AB-1234 (keeps driver context working)
 * - vehicle_locations history for TRP-1001 -> cleared
 */
import { sequelize } from '../src/config/db';

(async () => {
  await sequelize.authenticate();
  await sequelize.query(
    `UPDATE trips SET status='planned', started_at=NULL, actual_arrival_at=NULL, progress_percent=0, eta=now() + interval '2.5 hours' WHERE id='TRP-1001'`,
  );
  await sequelize.query(
    `UPDATE vehicles SET tracking_active=false, current_trip_id=NULL, live_status='OFFLINE', status='idle', speed=0, current_heading=0 WHERE id='AS-01-AB-1234'`,
  );
  await sequelize.query(
    `UPDATE drivers SET vehicle_id='AS-01-AB-1234', status='active' WHERE id='DRV-01'`,
  );
  await sequelize.query(`DELETE FROM vehicle_locations WHERE trip_id='TRP-1001'`);
  await sequelize.query(`DELETE FROM vehicle_locations WHERE vehicle_id='AS-01-AB-1234'`);
  const trip = await sequelize.query(`SELECT status, started_at FROM trips WHERE id='TRP-1001'`);
  const loc = await sequelize.query(`SELECT count(*)::int AS n FROM vehicle_locations`);
  console.log('✅ reset-tracking done:', JSON.stringify({ trip: trip[0], remainingLocations: loc[0] }));
  await sequelize.close();
})().catch((e) => {
  console.error('❌ reset-tracking failed:', e.message);
  process.exit(1);
});
