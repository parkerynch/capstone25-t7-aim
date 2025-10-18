import { Schema, model, Document } from 'mongoose';

export interface IProject extends Document {
    fileName: string;
    uploadDate: Date;
}

const projectSchema = new Schema<IProject>({
    fileName: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now },
});

export const Project = model<IProject>('Project', projectSchema);