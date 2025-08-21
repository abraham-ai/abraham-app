import { UserDocument } from './User'
import { Document, Schema, model } from 'mongoose'

export interface MannaVoucherSchema {
  amount: number
  code: string
  used: boolean
  allowedUserIds?: string[]
  redeemedBy?: UserDocument
  action?: string
  createdAt?: Date
  updatedAt?: Date | number
}

export interface MannaVoucherInput {
  amount: number
  code: string
  allowedUserIds?: string[]
  action?: string
}

export enum VoucherAction {
  AddManna = 'manna',
  GrantEden2Access = 'eden2_access',
  SubscriptionTrialPro30d = 'subscription_trial_pro_30d',
}

export interface MannaVoucherDocument extends MannaVoucherSchema, Document {}

const mannavoucher = new Schema<MannaVoucherDocument>(
  {
    amount: {
      type: Number,
      required: true,
    },
    code: {
      type: String,
      required: true,
      maxlength: 42,
    },
    used: {
      type: Boolean,
      default: false,
    },
    allowedUserIds: {
      type: [String],
    },
    redeemedBy: {
      type: Schema.Types.ObjectId,
      ref: 'creators',
    },
    action: {
      type: String,
      enum: Object.values(VoucherAction),
    },
  },
  {
    timestamps: true,
  },
)

mannavoucher.pre<MannaVoucherDocument>('save', function (next) {
  this.updatedAt = Date.now()

  next()
})

mannavoucher.index(
  { code: 1, used: 1 },
  { collation: { locale: 'en', strength: 2 } },
)

export const MannaVoucher = model<MannaVoucherDocument>(
  'mannavouchers',
  mannavoucher,
)
