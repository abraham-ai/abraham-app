import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IUserWallet extends Document {
  privyUserId: string;
  walletId: string;
  address: string;
}

const UserWalletSchema = new Schema<IUserWallet>({
  privyUserId: { type: String, required: true, unique: true },
  walletId: { type: String, required: true },
  address: { type: String, required: true },
});

export const UserWallet =
  models.UserWallet || model<IUserWallet>("UserWallet", UserWalletSchema);
