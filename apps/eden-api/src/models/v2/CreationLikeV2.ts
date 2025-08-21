import { Schema, model } from 'mongoose'
import paginate from 'mongoose-paginate-v2'

export interface CreationLikeV2Schema {
  user: Schema.Types.ObjectId
  creation: Schema.Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
}

export interface CreationLikeV2Document extends CreationLikeV2Schema {}

const CreationLikeV2Schema = new Schema<CreationLikeV2Document>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    creation: {
      type: Schema.Types.ObjectId,
      ref: 'creations3',
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Ensure a user can only like a creation once
CreationLikeV2Schema.index({ user: 1, creation: 1 }, { unique: true })

// Index for querying likes by creation
CreationLikeV2Schema.index({ creation: 1 })

// Index for querying likes by user
CreationLikeV2Schema.index({ user: 1 })

CreationLikeV2Schema.plugin(paginate)

export const CreationLikeV2 = model<CreationLikeV2Document>(
  'creationLikes3',
  CreationLikeV2Schema,
)
