import { AgentDocument } from '../Agent'
import { UserDocument } from '../User'
import { ThreadMessage } from '@edenlabs/eden-sdk'
import { ObjectId } from 'mongodb'
import { Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongooseDelete, {
  SoftDeleteDocument,
  SoftDeleteModel,
} from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface ThreadSchema {
  user: UserDocument
  agent: AgentDocument
  active?: string[]
  name: string
  title?: string
  messages: ThreadMessage[]
  key?: string
  createdAt: Date
  updatedAt: Date
}

export interface ThreadInput {
  user: ObjectId
}

export interface ThreadDocument extends ThreadSchema, SoftDeleteDocument {}

export const threadSchema = new Schema<ThreadDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    agent: {
      type: Schema.Types.ObjectId,
      ref: 'agent',
    },
    title: {
      type: Schema.Types.String,
    },
    key: {
      type: Schema.Types.String,
    },
    active: {
      type: [Schema.Types.String],
    },
    messages: {
      type: [Schema.Types.Mixed],
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

threadSchema.index({ updatedAt: -1 })
threadSchema.index({ agent: 1, updatedAt: -1 })
threadSchema.index({ user: 1, updatedAt: -1 })
threadSchema.index({ 'messages.role': 1, agent: 1 })
threadSchema.index({ agent: 1, user: 1, updatedAt: -1 })
threadSchema.index({ 'messages.role': 1, 'messages.tool_calls': 1 })
threadSchema.index({ agent: 1, 'messages.role': 1, updatedAt: -1 })
threadSchema.index({
  agent: 1,
  'messages.role': 1,
  'messages.tool_calls.task': 1,
  'messages.tool_calls': 1,
})
threadSchema.index({ 'messages.pinned': 1 })
threadSchema.plugin(paginate)
threadSchema.plugin(aggregatePaginate)
threadSchema.plugin(mongooseDelete, {
  overrideMethods: ['find', 'findOne', 'countDocuments', 'count'],
})

export const Thread = model<ThreadDocument>(
  'threads3',
  threadSchema,
) as SoftDeleteModel<ThreadDocument>
