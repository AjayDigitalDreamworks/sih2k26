import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class FieldTask extends Model {
  public id!: string;
  public title!: string;
  public issue_type!: string;
  public priority!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  public status!: 'ASSIGNED' | 'ACCEPTED' | 'EN_ROUTE' | 'ARRIVED' | 'VERIFYING' | 'VERIFIED' | 'REJECTED' | 'UNSAFE_TO_VERIFY' | 'CLOSED';
  public district_id!: string;
  public assigned_officer_id?: string | null;
  public alert_id?: string | null;
  public description?: string | null;
  public latitude!: number;
  public longitude!: number;
  public location_name?: string | null;
  public target_completion_at?: Date | null;
  public notes?: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FieldTask.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    issue_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'ROAD_DAMAGE',
    },
    priority: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
      allowNull: false,
      defaultValue: 'MEDIUM',
    },
    status: {
      type: DataTypes.ENUM(
        'ASSIGNED',
        'ACCEPTED',
        'EN_ROUTE',
        'ARRIVED',
        'VERIFYING',
        'VERIFIED',
        'REJECTED',
        'UNSAFE_TO_VERIFY',
        'CLOSED'
      ),
      allowNull: false,
      defaultValue: 'ASSIGNED',
    },
    district_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'kamrup',
    },
    assigned_officer_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    alert_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    longitude: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    location_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    target_completion_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'field_tasks',
    timestamps: true,
  }
);

