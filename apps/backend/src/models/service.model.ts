import { Schema, model, Document } from 'mongoose';

export interface IService extends Document {
    deploymentId: Schema.Types.ObjectId;
    type: 'FRONTEND' | 'BACKEND';
    url: string;
    status: 'DEPLOYING' | 'RUNNING' | 'STOPPED' | 'FAILED';
}

const serviceSchema = new Schema<IService>({
    deploymentId: { type: Schema.Types.ObjectId, ref: 'Deployment', required: true },
    type: { type: String, enum: ['FRONTEND', 'BACKEND'], required: true },
    url: { type: String },
    status: { type: String, enum: ['DEPLOYING', 'RUNNING', 'STOPPED', 'FAILED'], default: 'DEPLOYING' },
});

export const Service = model<IService>('Service', serviceSchema);