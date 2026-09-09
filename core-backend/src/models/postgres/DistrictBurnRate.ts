import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class DistrictBurnRate extends Model {
  public id!: string;
  public district_id!: string;
  public commodity!: 'oxygen' | 'food' | 'fuel' | 'medicine' | 'general';
  public rate_value!: number;
  public rate_unit!: 'kg_per_bed_day' | 'kg_per_person_day' | 'liters_per_person_day' | 'kg_per_day';
  public effective_from!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DistrictBurnRate.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    district_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    commodity: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    rate_value: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    rate_unit: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'kg_per_day',
    },
    effective_from: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'district_burn_rates',
    timestamps: true,
  }
);
