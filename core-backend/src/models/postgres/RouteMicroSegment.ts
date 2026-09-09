import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class RouteMicroSegment extends Model {
  public id!: string;
  public route_id!: string;
  public segment_index!: number;
  public start_chainage_km!: number;
  public end_chainage_km!: number;
  public length_m!: number;
  public slope_pct!: number;
  public elevation_start_m!: number;
  public elevation_end_m!: number;
  public tortuosity!: number;
  public current_risk_score!: number;
  public risk_level!: 'low' | 'medium' | 'high' | 'critical';
  public hazard_reason!: string | null;
  public geom!: string; // PostGIS GEOMETRY(LINESTRING, 4326) stored as GeoJSON
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RouteMicroSegment.init(
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    route_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      references: {
        model: 'routes',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    segment_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    start_chainage_km: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    end_chainage_km: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    length_m: {
      type: DataTypes.DOUBLE,
      defaultValue: 500.0,
    },
    slope_pct: {
      type: DataTypes.DOUBLE,
      defaultValue: 0.0,
    },
    elevation_start_m: {
      type: DataTypes.DOUBLE,
      defaultValue: 300.0,
    },
    elevation_end_m: {
      type: DataTypes.DOUBLE,
      defaultValue: 300.0,
    },
    tortuosity: {
      type: DataTypes.DOUBLE,
      defaultValue: 1.0,
    },
    current_risk_score: {
      type: DataTypes.INTEGER,
      defaultValue: 15,
    },
    risk_level: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      defaultValue: 'low',
    },
    hazard_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    geom: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{"type":"LineString","coordinates":[[0,0],[0,0]]}',
    },
  },
  {
    sequelize,
    tableName: 'route_micro_segments',
    timestamps: true,
    indexes: [
      {
        fields: ['route_id', 'segment_index'],
        unique: true,
      },
    ],
  }
);
