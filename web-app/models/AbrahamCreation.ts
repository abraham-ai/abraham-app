import mongoose from "mongoose";

export interface IAbrahamCreation extends mongoose.Document {
  proposal: string;
  session_id: mongoose.Types.ObjectId;
  title: string;
  status: "seed" | "in_progress" | "completed" | string;
  createdAt: Date;
  updatedAt: Date;
}

const AbrahamCreationSchema = new mongoose.Schema<IAbrahamCreation>(
  {
    proposal: { type: String, required: true },
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    title: { type: String, required: true },
    status: { type: String, default: "seed" },
  },
  {
    collection: "abraham_creations",
    timestamps: true, // auto-manages createdAt & updatedAt
  }
);

export default mongoose.models.AbrahamCreation ||
  mongoose.model<IAbrahamCreation>("AbrahamCreation", AbrahamCreationSchema);
