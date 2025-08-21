import { CharacterDocument } from './Character'
import { CreationDocument } from './Creation'
import { SessionDocument } from './Session'
import { TaskDocument } from './Task'
import { UserDocument } from './User'
import { ChatMessage, SessionEventType } from '@edenlabs/eden-sdk'
import { Schema, model } from 'mongoose'
import { SoftDeleteDocument } from 'mongoose-delete'
import paginate from 'mongoose-paginate-v2'

export interface SessionEventSchema {
  session: SessionDocument
  type: SessionEventType
  data: {
    character_add?: {
      character: CharacterDocument
    }
    interaction?: {
      user: UserDocument
      message: string
      context?: ChatMessage[]
      addressedCharacters?: CharacterDocument[]
    }
    chat_response?: {
      interaction: SessionEventDocument
      message: string
    }
    creation_response?: {
      interaction: SessionEventDocument
      task: TaskDocument
      creations?: {
        id: CreationDocument
        uri: string
      }[]
      message?: string
    }
    error_response?: {
      interaction: SessionEventDocument
      message: string
      task?: TaskDocument
    }
  }
  createdAt?: Date
}

export interface SessionEventDocument
  extends SessionEventSchema,
    SoftDeleteDocument {}

const sessionEvent = new Schema<SessionEventDocument>(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'sessions',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(SessionEventType),
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

sessionEvent.index({ createdAt: 1 })
sessionEvent.plugin(paginate)

export const SessionEvent = model<SessionEventDocument>(
  'sessionEvents',
  sessionEvent,
)
