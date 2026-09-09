import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class DeadZoneSegment extends Model {
  public id!: string;
  public corridor_id!: string;
  public name!: string;
  public entry_checkpost_id!: string;
  public entry_checkpost_name!: string;
  public exit_checkpost_id!: string;
  public exit_checkpost_name!: string;
  public length_km!: number;
  public default_speed_kmh!: number;
  public geom!: string; // PostGIS GEOMETRY(LINESTRING, 4326) stored as GeoJSON
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DeadZoneSegment.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    corridor_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    entry_checkpost_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    entry_checkpost_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    exit_checkpost_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    exit_checkpost_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    length_km: {
      type: DataTypes.DOUBLE,
      defaultValue: 24.0,
    },
    default_speed_kmh: {
      type: DataTypes.DOUBLE,
      defaultValue: 30.0,
    },
    geom: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{"type":"LineString","coordinates":[]}',
    },
  },
  {
    sequelize,
    tableName: 'dead_zone_segments',
    timestamps: true,
  }
);
