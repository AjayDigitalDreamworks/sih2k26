import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class Vehicle extends Model {
  public id!: string; // registration number e.g. AS-01-AB-1234
  public model!: string;
  public transporter_id!: string;
  public type!: string;
  public capacity_kg!: number;
  public status!: 'moving' | 'idle' | 'stopped' | 'delayed' | 'offline' | 'maintenance';
  public current_lat!: number;
  public current_lng!: number;
  public speed!: number;
  public fuel_percent!: number;
  public current_route?: string | null;
  public assigned_driver_id?: string | null;
  public last_ping_at!: Date;
  // Real-GPS live-tracking state (source of truth: vehicle_locations history)
  public tracking_active!: boolean;
  public current_trip_id?: string | null;
  public current_heading?: number | null;
  public current_accuracy?: number | null;
  public gps_source?: string | null;
  public last_gps_at?: Date | null;
  public live_status?: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Vehicle.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    model: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    transporter_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'transporter_01',
    },
    type: {
      type: DataTypes.STRING(50),
      defaultValue: 'Medium Commercial Vehicle',
    },
    capacity_kg: {
      type: DataTypes.INTEGER,
      defaultValue: 5000,
    },
    status: {
      type: DataTypes.ENUM('moving', 'idle', 'stopped', 'delayed', 'offline', 'maintenance'),
      // A newly registered vehicle has NO live telemetry yet — it must never
      // default to 'moving'. Real GPS updates set the real status server-side.
      defaultValue: 'idle',
    },
    current_lat: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    current_lng: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    speed: {
      type: DataTypes.DOUBLE,
      defaultValue: 0,
    },
    fuel_percent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    current_route: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    assigned_driver_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    last_ping_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    tracking_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    current_trip_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    current_heading: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    current_accuracy: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    gps_source: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'WEB_GPS',
    },
    last_gps_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    live_status: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'OFFLINE',
    },
  },
  {
    sequelize,
    tableName: 'vehicles',
    timestamps: true,
  }
);
