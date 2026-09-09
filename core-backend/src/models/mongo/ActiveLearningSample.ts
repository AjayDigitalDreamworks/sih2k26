import mongoose, { Schema, Document } from 'mongoose';

export interface IActiveLearningSample extends Document {
  sampleId: string;
  routeId?: string;
  districtId?: string;
  predictedRiskScore: number;
  predictedRiskLevel: string;
  actualOutcome: 'disruption' | 'stranded' | 'smooth_transit';
  actualRiskScore: number;
  isFalseNegative: boolean;
  isFalsePositive: boolean;
  sampleWeight: number; // e.g. 4.0 for hard false negatives, 1.0 for smooth
  features: {
    slope_risk: number;
    rainfall_24h_mm: number;
    road_condition: number;
    bridge_condition: number;
    historical_disruptions: number;
    congestion_level: number;
    flood_risk_level: number;
    landslide_probability: number;
    elevation_m: number;
    river_proximity: number;
    month: number;
    road_distance_km: number;
  };
  source: 'field_report_verified' | 'trip_completed' | 'trip_stranded' | 'simulation_test';
  referenceId?: string;
  status: 'pending' | 'incorporated';
  retrainedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ActiveLearningSampleSchema: Schema = new Schema(
  {
    sampleId: { type: String, required: true, unique: true, index: true },
    routeId: { type: String, index: true },
    districtId: { type: String, index: true },
    predictedRiskScore: { type: Number, required: true },
    predictedRiskLevel: { type: String, default: 'medium' },
    actualOutcome: {
      type: String,
      enum: ['disruption', 'stranded', 'smooth_transit'],
      required: true,
      index: true,
    },
    actualRiskScore: { type: Number, required: true },
    isFalseNegative: { type: Boolean, default: false, index: true },
    isFalsePositive: { type: Boolean, default: false },
    sampleWeight: { type: Number, default: 1.0 },
    features: {
      slope_risk: { type: Number, default: 0.2 },
      rainfall_24h_mm: { type: Number, default: 10.0 },
      road_condition: { type: Number, default: 3.0 },
      bridge_condition: { type: Number, default: 4.0 },
      historical_disruptions: { type: Number, default: 1 },
      congestion_level: { type: Number, default: 1.0 },
      flood_risk_level: { type: Number, default: 0.1 },
      landslide_probability: { type: Number, default: 0.1 },
      elevation_m: { type: Number, default: 200 },
      river_proximity: { type: Number, default: 2.0 },
      month: { type: Number, default: new Date().getMonth() + 1 },
      road_distance_km: { type: Number, default: 50.0 },
    },
    source: {
      type: String,
      enum: ['field_report_verified', 'trip_completed', 'trip_stranded', 'simulation_test'],
      required: true,
    },
    referenceId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'incorporated'],
      default: 'pending',
      index: true,
    },
    retrainedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

export const ActiveLearningSample = mongoose.model<IActiveLearningSample>(
  'ActiveLearningSample',
  ActiveLearningSampleSchema
);
