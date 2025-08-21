import { UserDocument } from './User'
import { Document, Schema, model } from 'mongoose'

export interface MannaSchema {
  user: UserDocument
  balance: number
  subscriptionBalance: number
  createdAt?: Date
  updatedAt?: Date
}

export interface MannaInput {
  creator: string
  balance?: number
}

export interface MannaDocument extends MannaSchema, Document {}

const manna = new Schema<MannaDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    subscriptionBalance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

manna.pre<MannaDocument>('save', function (next) {
  this.updatedAt = new Date()

  next()
})

export const Manna = model<MannaDocument>('manna', manna)
