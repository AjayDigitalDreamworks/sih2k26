import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class Bridge extends Model {
  public id!: string;
  public name!: string;
  public road_id!: string;
  public district_id!: string;
  public status!: 'operational' | 'damaged' | 'closed';
  public load_capacity_tons!: number;
  public lat!: number;
  public lng!: number;
  public is_bailey_bridge!: boolean;
  public corridor_id?: string | null;
  public verified_at!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Bridge.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    road_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    district_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('operational', 'damaged', 'closed'),
      defaultValue: 'operational',
    },
    load_capacity_tons: {
      type: DataTypes.DOUBLE,
      defaultValue: 40.0,
    },
    lat: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    lng: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    is_bailey_bridge: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    corridor_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    verified_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'bridges',
    timestamps: true,
  }
);
