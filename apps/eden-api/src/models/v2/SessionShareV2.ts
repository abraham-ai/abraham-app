import { UserDocument } from '../User'
import { SessionDocument } from './SessionV2'
import { ObjectId } from 'mongodb'
import { Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongooseDelete, {
  SoftDeleteDocument,
  SoftDeleteModel,
} from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface SessionShareSchema {
  session: SessionDocument
  owner: UserDocument
  message_id: ObjectId
  title?: string
  createdAt: Date
  updatedAt: Date
}

export interface SessionShareInput {
  session: ObjectId
  owner: ObjectId
  message_id: ObjectId
  title?: string
}

export interface SessionShareDocument
  extends SessionShareSchema,
    SoftDeleteDocument {}

export const sessionShareSchema = new Schema<SessionShareDocument>(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'sessions',
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    message_id: {
      type: Schema.Types.ObjectId,
      ref: 'messages',
      required: true,
    },
    title: {
      type: Schema.Types.String,
      maxlength: 200,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes for performance
sessionShareSchema.index({ session: 1, owner: 1 })
sessionShareSchema.index({ createdAt: -1 })

sessionShareSchema.plugin(paginate)
sessionShareSchema.plugin(aggregatePaginate)
sessionShareSchema.plugin(mongooseDelete, {
  overrideMethods: ['find', 'findOne', 'countDocuments', 'count'],
})

export const SessionShare = model<SessionShareDocument>(
  'session_shares',
  sessionShareSchema,
) as SoftDeleteModel<SessionShareDocument>
