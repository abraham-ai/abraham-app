import { ObjectId, Schema, model } from 'mongoose'

export interface CronSchedule {
  year?: number | string
  month?: number | string
  day?: number | string
  week?: number | string
  day_of_week?: number | string
  hour?: number | string
  minute?: number | string
  second?: number | string
  start_date?: Date
  end_date?: Date
  timezone?: string
}

export interface TriggerSchema {
  trigger_id: string
  user: ObjectId
  agent: ObjectId
  session_type: 'new' | 'another'
  session?: ObjectId
  schedule: CronSchedule
  instruction: string
  update_config?: any
  status?: 'active' | 'paused' | 'finished'
  posting_instructions?: {
    post_to: 'same' | 'another' | 'discord' | 'telegram' | 'x' | 'farcaster'
    session_id?: ObjectId | null
    channel_id?: string | null
    custom_instructions?: string
  }
  deleted?: boolean
  last_run_time?: Date
  next_scheduled_run?: Date
}

export interface TriggerDocument extends TriggerSchema {}

const TriggerSchema = new Schema<TriggerDocument>(
  {
    trigger_id: {
      type: String,
      required: true,
    },
    agent: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    session_type: {
      type: String,
      enum: ['new', 'another'],
      default: 'new',
    },
    session: {
      type: Schema.Types.ObjectId,
      ref: 'sessions',
      required: false,
    },
    schedule: {
      type: Object,
      required: true,
    },
    instruction: {
      type: String,
      required: true,
    },
    update_config: {
      type: Object,
      required: false,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'finished'],
      default: 'active',
    },
    posting_instructions: {
      type: Object,
      required: false,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    last_run_time: {
      type: Date,
      required: false,
    },
    next_scheduled_run: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  },
)

TriggerSchema.index({ agent: 1 })

export const Trigger = model<TriggerDocument>('triggers2', TriggerSchema)
