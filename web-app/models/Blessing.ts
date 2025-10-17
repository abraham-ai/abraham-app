import mongoose, { Schema, Types } from "mongoose";

export interface IBlessing extends mongoose.Document {
  creationId: Types.ObjectId;
  session_id?: Types.ObjectId;
  blesserEoa?: string | null;
  blesserSmartWallet?: string | null;
  onchainRef?: string | null; // e.g., tx hash or onchain id
  createdAt: Date;
  updatedAt: Date;
}

const BlessingSchema = new Schema<IBlessing>(
  {
    creationId: {
      type: Schema.Types.ObjectId,
      ref: "AbrahamCreation",
      required: true,
      index: true,
    },
    session_id: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: false,
    },
    blesserEoa: { type: String, required: false, default: null, index: true },
    blesserSmartWallet: {
      type: String,
      required: false,
      default: null,
      index: true,
    },
    onchainRef: { type: String, required: false, default: null },
  },
  { collection: "abraham_blessings", timestamps: true }
);

export default mongoose.models.Blessing ||
  mongoose.model<IBlessing>("Blessing", BlessingSchema);
