import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class RateConfig extends Model {
  public id!: string;
  public config_key!: string;
  public rate_value!: number;
  public rate_unit!: string;
  public vehicle_class!: string;
  public effective_from!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RateConfig.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    config_key: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    rate_value: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 14.50,
    },
    rate_unit: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'INR_per_km',
    },
    vehicle_class: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'medium_commercial',
    },
    effective_from: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'rate_configs',
    timestamps: true,
  }
);
