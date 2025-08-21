import { AgentDocument } from '../Agent'
import { UserDocument } from '../User'
import { Message, MessageDocument } from './Message'
import { ObjectId } from 'mongodb'
import { Schema, model } from 'mongoose'
import aggregatePaginate from 'mongoose-aggregate-paginate-v2'
import mongooseDelete, {
  SoftDeleteDocument,
  SoftDeleteModel,
} from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface SessionSchema {
  owner: UserDocument
  users?: UserDocument[]
  agents: AgentDocument[]
  status: 'active' | 'archived'
  title?: string
  channel?: string
  scenario?: string
  messages: MessageDocument[]
  budget?: {
    token_budget?: number
    manna_budget?: number
    turn_budget?: number
    tokens_spent?: number
    manna_spent?: number
    turns_spent?: number
  }
  autonomy_settings?: {
    auto_reply: boolean
    reply_interval: number
    actor_selection_method: 'random' | 'random_exclude_last'
  }
  last_actor_id?: ObjectId
  trigger?: ObjectId
  createdAt: Date
  updatedAt: Date
}

export interface SessionInput {
  owner: ObjectId
}

export interface SessionDocument extends SessionSchema, SoftDeleteDocument {}

export const sessionSchema = new Schema<SessionDocument>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    users: {
      type: [Schema.Types.ObjectId],
      ref: 'users3',
    },
    agents: {
      type: [Schema.Types.ObjectId],
      ref: 'users3',
    },
    status: {
      type: Schema.Types.String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    channel: {
      type: Schema.Types.String,
    },
    title: {
      type: Schema.Types.String,
    },
    scenario: {
      type: Schema.Types.String,
    },
    messages: [
      {
        type: Schema.Types.ObjectId,
        ref: 'messages',
      },
    ],
    budget: {
      token_budget: {
        type: Schema.Types.Number,
      },
      manna_budget: {
        type: Schema.Types.Number,
      },
      turn_budget: {
        type: Schema.Types.Number,
      },
      tokens_spent: {
        type: Schema.Types.Number,
        default: 0,
      },
      manna_spent: {
        type: Schema.Types.Number,
        default: 0,
      },
      turns_spent: {
        type: Schema.Types.Number,
        default: 0,
      },
    },
    autonomy_settings: {
      type: {
        auto_reply: {
          type: Schema.Types.Boolean,
          default: false,
        },
        reply_interval: {
          type: Schema.Types.Number,
          default: 0,
        },
        actor_selection_method: {
          type: Schema.Types.String,
          enum: ['random', 'random_exclude_last'],
          default: 'random',
        },
      },
      default: null,
    },
    last_actor_id: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
    },
    trigger: {
      type: Schema.Types.ObjectId,
      ref: 'triggers2',
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

// sessionSchema.index({ updatedAt: -1 })
// sessionSchema.index({ agents: 1, updatedAt: -1 })
// sessionSchema.index({ owner: 1, updatedAt: -1 })
// sessionSchema.index({ 'messages.role': 1, agents: 1 })
// sessionSchema.index({ agents: 1, owner: 1, updatedAt: -1 })
// sessionSchema.index({ 'messages.role': 1, 'messages.tool_calls': 1 })
// sessionSchema.index({ agents: 1, 'messages.role': 1, updatedAt: -1 })
// sessionSchema.index({
//   agents: 1,
//   'messages.role': 1,
//   'messages.tool_calls.task': 1,
//   'messages.tool_calls': 1,
// })
// sessionSchema.index({ 'messages.pinned': 1 })
sessionSchema.plugin(paginate)
sessionSchema.plugin(aggregatePaginate)
sessionSchema.plugin(mongooseDelete, {
  overrideMethods: ['find', 'findOne', 'countDocuments', 'count'],
})

// Ensure Message model is registered before Session
if (!model('messages')) {
  model('messages', Message.schema)
}

export const Session = model<SessionDocument>(
  'sessions',
  sessionSchema,
) as SoftDeleteModel<SessionDocument>
