import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class Driver extends Model {
  public id!: string;
  public name!: string;
  public phone?: string | null;
  public license_number?: string | null;
  public license_expiry?: Date | null;
  public vehicle_id?: string | null;
  public transporter_id!: string;
  public user_id?: string | null; // links the login account (role: driver) to this driver record
  public status!: 'active' | 'on_leave' | 'inactive';
  public rating!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Driver.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    license_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    license_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    vehicle_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    transporter_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'transporter_01',
    },
    user_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'on_leave', 'inactive'),
      defaultValue: 'active',
    },
    rating: {
      type: DataTypes.DOUBLE,
      defaultValue: 4.8,
    },
  },
  {
    sequelize,
    tableName: 'drivers',
    timestamps: true,
  }
);
