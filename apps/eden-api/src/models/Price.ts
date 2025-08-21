import { Document, Schema, model } from 'mongoose'

export interface PriceSchema {
  priceId: string
  price: number
  isSubscription: boolean
  mannaAmount: number
  createdAt?: Date
}

export interface PriceDocument extends PriceSchema, Document {}

const price = new Schema<PriceDocument>(
  {
    priceId: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    isSubscription: {
      type: Boolean,
      required: true,
    },
    mannaAmount: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

export const Price = model<PriceDocument>('price', price)
