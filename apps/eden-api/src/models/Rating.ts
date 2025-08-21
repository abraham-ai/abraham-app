import { CreationDocument } from './Creation'
import { UserDocument } from './User'
import { ObjectId } from 'mongodb'
import { Document, Schema, model } from 'mongoose'

export interface RatingSchema {
  user: UserDocument
  creation: CreationDocument
  rating: number
  createdAt?: Date
  updatedAt?: Date
}

export interface RatingInput {
  creator: ObjectId
  creation: ObjectId
  rating: number
}

export interface RatingDocument extends RatingSchema, Document {}

const rating = new Schema<RatingDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    creation: {
      type: Schema.Types.ObjectId,
      ref: 'creations',
      required: true,
    },
    rating: {
      type: Schema.Types.Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

rating.index({ user: 1, creation: 1 }, { unique: true })
rating.index({ createdAt: 1 })

export const Rating = model<RatingDocument>('ratings', rating)
