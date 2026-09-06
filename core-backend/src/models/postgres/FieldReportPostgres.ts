import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class FieldReportPostgres extends Model {
  public id!: string;
  public idempotency_key?: string | null;
  public officer_id!: string;
  public district_id!: string;
  public issue_type!: string;
  public severity!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  public road_status!: 'OPEN' | 'PARTIALLY_BLOCKED' | 'CLOSED' | 'DANGEROUS' | 'UNKNOWN';
  public safety_status!: 'SAFE' | 'CAUTION_REQUIRED' | 'HIGH_DANGER' | 'EVACUATE';
  public immediate_action_required!: boolean;
  public recommended_actions?: string | null;
  public description!: string;
  public latitude!: number;
  public longitude!: number;
  public accuracy_m?: number | null;
  public status!: 'SUBMITTED' | 'VERIFIED' | 'FORWARDED_TO_ADMIN' | 'CLOSED';
  public source!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FieldReportPostgres.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    idempotency_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    officer_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    district_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'kamrup',
    },
    issue_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    severity: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
      allowNull: false,
      defaultValue: 'MEDIUM',
    },
    road_status: {
      type: DataTypes.ENUM('OPEN', 'PARTIALLY_BLOCKED', 'CLOSED', 'DANGEROUS', 'UNKNOWN'),
      allowNull: false,
      defaultValue: 'OPEN',
    },
    safety_status: {
      type: DataTypes.ENUM('SAFE', 'CAUTION_REQUIRED', 'HIGH_DANGER', 'EVACUATE'),
      allowNull: false,
      defaultValue: 'SAFE',
    },
    immediate_action_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    recommended_actions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    latitude: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    longitude: {
      type: DataTypes.DOUBLE,
      allowNull: false,
    },
    accuracy_m: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('SUBMITTED', 'VERIFIED', 'FORWARDED_TO_ADMIN', 'CLOSED'),
      allowNull: false,
      defaultValue: 'SUBMITTED',
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'FIELD_OFFICER_WEB',
    },
  },
  {
    sequelize,
    tableName: 'field_reports',
    timestamps: true,
  }
);

