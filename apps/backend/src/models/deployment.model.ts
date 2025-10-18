import { Schema, model, Document } from 'mongoose';

export interface IDeployment extends Document {
    projectId: Schema.Types.ObjectId;
    status: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';
    createdAt: Date;
    updatedAt: Date;
}

const deploymentSchema = new Schema<IDeployment>({
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED'], default: 'PENDING' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

export const Deployment = model<IDeployment>('Deployment', deploymentSchema);