import { User } from './User';
import { District } from './District';
import { Road } from './Road';
import { Bridge } from './Bridge';
import { Route } from './Route';
import { RiskScore } from './RiskScore';
import { Vehicle } from './Vehicle';
import { Driver } from './Driver';
import { Trip } from './Trip';
import { Delivery } from './Delivery';
import { FieldTask } from './FieldTask';
import { FieldVerification } from './FieldVerification';
import { FieldReportPostgres } from './FieldReportPostgres';
import { FieldMedia } from './FieldMedia';

// Define Associations
District.hasMany(Road, { foreignKey: 'district_id', as: 'roads' });
Road.belongsTo(District, { foreignKey: 'district_id', as: 'district' });

Road.hasMany(Bridge, { foreignKey: 'road_id', as: 'bridges' });
Bridge.belongsTo(Road, { foreignKey: 'road_id', as: 'road' });

District.hasMany(Bridge, { foreignKey: 'district_id', as: 'bridges' });
Bridge.belongsTo(District, { foreignKey: 'district_id', as: 'district' });

Route.hasMany(RiskScore, { foreignKey: 'route_id', as: 'risk_scores' });
RiskScore.belongsTo(Route, { foreignKey: 'route_id', as: 'route' });

Vehicle.hasOne(Driver, { foreignKey: 'vehicle_id', as: 'driver' });
Driver.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

Vehicle.hasMany(Trip, { foreignKey: 'vehicle_id', as: 'trips' });
Trip.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

Driver.hasMany(Trip, { foreignKey: 'driver_id', as: 'trips' });
Trip.belongsTo(Driver, { foreignKey: 'driver_id', as: 'driver' });

Route.hasMany(Trip, { foreignKey: 'route_id', as: 'trips' });
Trip.belongsTo(Route, { foreignKey: 'route_id', as: 'route' });

Trip.hasMany(Delivery, { foreignKey: 'trip_id', as: 'deliveries' });
Delivery.belongsTo(Trip, { foreignKey: 'trip_id', as: 'trip' });

// Field Officer Associations
User.hasMany(FieldTask, { foreignKey: 'assigned_officer_id', as: 'assigned_tasks' });
FieldTask.belongsTo(User, { foreignKey: 'assigned_officer_id', as: 'officer' });

FieldTask.hasOne(FieldVerification, { foreignKey: 'task_id', as: 'verification' });
FieldVerification.belongsTo(FieldTask, { foreignKey: 'task_id', as: 'task' });

User.hasMany(FieldVerification, { foreignKey: 'officer_id', as: 'verifications' });
FieldVerification.belongsTo(User, { foreignKey: 'officer_id', as: 'officer' });

User.hasMany(FieldReportPostgres, { foreignKey: 'officer_id', as: 'field_reports' });
FieldReportPostgres.belongsTo(User, { foreignKey: 'officer_id', as: 'officer' });

FieldTask.hasMany(FieldMedia, { foreignKey: 'task_id', as: 'media' });
FieldMedia.belongsTo(FieldTask, { foreignKey: 'task_id', as: 'task' });

FieldReportPostgres.hasMany(FieldMedia, { foreignKey: 'report_id', as: 'media' });
FieldMedia.belongsTo(FieldReportPostgres, { foreignKey: 'report_id', as: 'report' });

FieldVerification.hasMany(FieldMedia, { foreignKey: 'verification_id', as: 'media' });
FieldMedia.belongsTo(FieldVerification, { foreignKey: 'verification_id', as: 'verification' });

export {
  User,
  District,
  Road,
  Bridge,
  Route,
  RiskScore,
  Vehicle,
  Driver,
  Trip,
  Delivery,
  FieldTask,
  FieldVerification,
  FieldReportPostgres,
  FieldMedia,
};
