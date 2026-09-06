import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class FieldVerification extends Model {
  public id!: string;
  public task_id!: string;
  public officer_id!: string;
  public verification_result!: 'CONFIRMED' | 'PARTIALLY_CONFIRMED' | 'NOT_FOUND' | 'DIFFERENT_ISSUE' | 'UNSAFE_TO_VERIFY' | 'CANNOT_VERIFY';
  public observed_severity!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  public road_passability!: 'PASSABLE' | 'PARTIALLY_BLOCKED' | 'SINGLE_LANE_ONLY' | 'IMPASSABLE_4W' | 'IMPASSABLE_ALL';
  public safety_status!: 'SAFE' | 'CAUTION_REQUIRED' | 'HIGH_DANGER' | 'EVACUATE';
  public action_recommended!: 'NONE' | 'ROUTE_DIVERSION' | 'TEMPORARY_CLOSURE' | 'EMERGENCY_REPAIR' | 'STRUCTURAL_INSPECTION';
  public observation_notes?: string | null;
  public unsafe_reason?: string | null;
  public latitude!: number;
  public longitude!: number;
  public gps_accuracy_m?: number | null;
  public verified_at!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FieldVerification.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    task_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    officer_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    verification_result: {
      type: DataTypes.ENUM(
        'CONFIRMED',
        'PARTIALLY_CONFIRMED',
        'NOT_FOUND',
        'DIFFERENT_ISSUE',
        'UNSAFE_TO_VERIFY',
        'CANNOT_VERIFY'
      ),
      allowNull: false,
      defaultValue: 'CONFIRMED',
    },
    observed_severity: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
      allowNull: false,
      defaultValue: 'MEDIUM',
    },
    road_passability: {
      type: DataTypes.ENUM(
        'PASSABLE',
        'PARTIALLY_BLOCKED',
        'SINGLE_LANE_ONLY',
        'IMPASSABLE_4W',
        'IMPASSABLE_ALL'
      ),
      allowNull: false,
      defaultValue: 'PASSABLE',
    },
    safety_status: {
      type: DataTypes.ENUM('SAFE', 'CAUTION_REQUIRED', 'HIGH_DANGER', 'EVACUATE'),
      allowNull: false,
      defaultValue: 'SAFE',
    },
    action_recommended: {
      type: DataTypes.ENUM(
        'NONE',
        'ROUTE_DIVERSION',
        'TEMPORARY_CLOSURE',
        'EMERGENCY_REPAIR',
        'STRUCTURAL_INSPECTION'
      ),
      allowNull: false,
      defaultValue: 'NONE',
    },
    observation_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    unsafe_reason: {
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
    gps_accuracy_m: {
      type: DataTypes.DOUBLE,
      allowNull: true,
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'field_verifications',
    timestamps: true,
  }
);

