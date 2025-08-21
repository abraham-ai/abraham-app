import { AgentDocument } from '../Agent'
import { UserDocument } from '../User'
import { SessionDocument } from './SessionV2'
import {
  Channel,
  EdenMessageData,
  MessageReaction,
  MessageRole,
  ToolCall,
} from '@edenlabs/eden-sdk'
import { Schema, model } from 'mongoose'

export interface MessageSchema {
  _id: string
  session: SessionDocument
  sender: UserDocument | AgentDocument
  role: MessageRole
  eden_message_data?: EdenMessageData
  content: string
  name?: string
  tool_call_id?: string
  channel?: Channel
  reply_to?: MessageDocument
  sender_name?: string
  reactions?: MessageReaction
  attachments?: string[]
  tool_calls?: ToolCall[]
  createdAt?: Date
  updatedAt?: Date
}

export interface MessageDocument extends MessageSchema {}

const messageSchema = new Schema<MessageDocument>(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'sessions',
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    role: {
      type: Schema.Types.String,
      enum: ['user', 'assistant', 'system', 'tool', 'eden'],
      required: true,
    },
    eden_message_data: {
      type: Schema.Types.Mixed,
    },
    content: {
      type: String,
    },
    name: {
      type: String,
    },
    tool_call_id: {
      type: String,
    },
    channel: {
      type: Schema.Types.Mixed,
    },
    tool_calls: {
      type: [Schema.Types.Mixed],
    },
    reply_to: {
      type: Schema.Types.ObjectId,
      ref: 'messages',
    },
    sender_name: {
      type: String,
    },
    attachments: {
      type: [String],
      default: [],
    },
    reactions: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
)

// Index for querying messages in a session
messageSchema.index({ session: 1, createdAt: 1 })

// Index for querying messages by sender
messageSchema.index({ sender: 1, createdAt: 1 })

export const Message = model<MessageDocument>('messages', messageSchema)
