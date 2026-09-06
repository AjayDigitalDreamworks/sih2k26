import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class District extends Model {
  public id!: string;
  public name!: string;
  public state!: string;
  public connectivity_status!: 'accessible' | 'partial' | 'blocked';
  public connectivity_score!: number;
  public population!: number;
  public geom!: string; // PostGIS GEOMETRY(POLYGON, 4326) stored as GeoJSON
  public centroid_lat!: number;
  public centroid_lng!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

District.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    connectivity_status: {
      type: DataTypes.ENUM('accessible', 'partial', 'blocked'),
      defaultValue: 'accessible',
    },
    connectivity_score: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
    },
    population: {
      type: DataTypes.INTEGER,
      defaultValue: 100000,
    },
    geom: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    centroid_lat: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    centroid_lng: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'districts',
    timestamps: true,
  }
);

// Helper to create GeoJSON polygon from bounding box (simplified for seed data)
export function createDistrictPolygon(lat: number, lng: number, radiusKm: number = 30): string {
  // Approximate 1 degree lat = 111km, 1 degree lng = 111km * cos(lat)
  const latRadius = radiusKm / 111;
  const lngRadius = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  
  const corners = [
    [lng - lngRadius, lat - latRadius], // SW
    [lng + lngRadius, lat - latRadius], // SE
    [lng + lngRadius, lat + latRadius], // NE
    [lng - lngRadius, lat + latRadius], // NW
    [lng - lngRadius, lat - latRadius], // Close polygon
  ];
  
  return JSON.stringify({
    type: 'Polygon',
    coordinates: [corners],
  });
}
