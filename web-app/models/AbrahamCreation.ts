import mongoose from "mongoose";

export interface IAbrahamCreation extends mongoose.Document {
  proposal: string;
  session_id: mongoose.Types.ObjectId;
  title: string;
  status: "seed" | "in_progress" | "completed" | "creation" | string;
  image?: string;
  tagline?: string;
  creation?: {
    index?: number;
    title?: string;
    tagline?: string;
    poster_image?: string;
    blog_post?: string;
    tx_hash?: string;
    ipfs_hash?: string;
    explorer_url?: string;
  };
  blessingsCount?: number;
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
    image: { type: String, required: false },
    tagline: { type: String, required: false },
    creation: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    blessingsCount: { type: Number, default: 0, index: true },
  },
  {
    collection: "abraham_seeds",
    timestamps: true, // auto-manages createdAt & updatedAt
  }
);

export default mongoose.models.AbrahamCreation ||
  mongoose.model<IAbrahamCreation>("AbrahamCreation", AbrahamCreationSchema);
