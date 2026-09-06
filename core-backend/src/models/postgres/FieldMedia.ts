import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/db';

export class FieldMedia extends Model {
  public id!: string;
  public report_id?: string | null;
  public task_id?: string | null;
  public verification_id?: string | null;
  public file_path!: string;
  public file_name!: string;
  public mime_type!: string;
  public file_size!: number;
  public caption?: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FieldMedia.init(
  {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    report_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    task_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    verification_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    file_path: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'image/jpeg',
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    caption: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'field_media',
    timestamps: true,
  }
);

