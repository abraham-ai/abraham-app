import { Schema, model } from 'mongoose'
import paginate from 'mongoose-paginate-v2'

export type LikeableEntityType = 'creation' | 'model' | 'agent'

export interface LikeV2Schema {
  user: Schema.Types.ObjectId
  entityType: LikeableEntityType
  entityId: Schema.Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
}

export interface LikeV2Document extends LikeV2Schema {}

const LikeV2Schema = new Schema<LikeV2Document>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    entityType: {
      type: String,
      enum: ['creation', 'model', 'agent'],
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Ensure a user can only like an entity once
LikeV2Schema.index({ user: 1, entityType: 1, entityId: 1 }, { unique: true })

// Index for querying likes by entity
LikeV2Schema.index({ entityType: 1, entityId: 1 })

// Index for querying likes by user
LikeV2Schema.index({ user: 1 })

LikeV2Schema.plugin(paginate)

export const LikeV2 = model<LikeV2Document>('likes3', LikeV2Schema)
