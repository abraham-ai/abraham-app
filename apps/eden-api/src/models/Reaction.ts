import { CreationDocument } from './Creation'
import { UserDocument } from './User'
import { ReactionType } from '@edenlabs/eden-sdk'
import { ObjectId } from 'mongodb'
import { Document, Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import paginate from 'mongoose-paginate-v2'

export interface ReactionSchema {
  user: UserDocument
  creation: CreationDocument
  reaction: ReactionType
  createdAt?: Date
}

export interface ReactionInput {
  creator: ObjectId
  creation: ObjectId
  reaction: ReactionType
}

export interface ReactionDocument extends ReactionSchema, Document {}

const reaction = new Schema<ReactionDocument>(
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
    reaction: {
      type: String,
      enum: Object.values(ReactionType),
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

reaction.index({ user: 1, creation: 1, reaction: 1 }, { unique: true })
reaction.plugin(paginate)
reaction.plugin(aggregatePaginate)

export const Reaction = model<ReactionDocument>('reactions', reaction)
