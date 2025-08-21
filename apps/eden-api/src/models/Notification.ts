import { ObjectId, Schema, model } from 'mongoose'

export type NotificationType =
  | 'trigger_complete'
  | 'trigger_failed'
  | 'trigger_started'
  | 'session_complete'
  | 'session_failed'
  | 'agent_mentioned'
  | 'system_alert'
  | 'agent_permission_added'
  | 'agent_permission_removed'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms'

export interface NotificationSchema {
  user: ObjectId
  type: NotificationType
  title: string
  message: string
  read: boolean
  read_at?: Date
  priority: NotificationPriority
  trigger?: ObjectId
  session?: ObjectId
  agent?: ObjectId
  channels: NotificationChannel[]
  delivered_channels: NotificationChannel[]
  delivery_attempted_at?: Date
  delivery_failed_channels: NotificationChannel[]
  metadata?: Record<string, any>
  action_url?: string
  expires_at?: Date
  archived: boolean
  archived_at?: Date
}

export interface NotificationDocument extends NotificationSchema {}

const NotificationSchema = new Schema<NotificationDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'trigger_complete',
        'trigger_failed',
        'trigger_started',
        'session_complete',
        'session_failed',
        'agent_mentioned',
        'system_alert',
        'agent_permission_added',
        'agent_permission_removed',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    read_at: {
      type: Date,
      required: false,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    trigger: {
      type: Schema.Types.ObjectId,
      ref: 'triggers2',
      required: false,
    },
    session: {
      type: Schema.Types.ObjectId,
      ref: 'sessions',
      required: false,
    },
    agent: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: false,
    },
    channels: {
      type: [String],
      enum: ['in_app', 'push', 'email', 'sms'],
      default: ['in_app'],
    },
    delivered_channels: {
      type: [String],
      enum: ['in_app', 'push', 'email', 'sms'],
      default: [],
    },
    delivery_attempted_at: {
      type: Date,
      required: false,
    },
    delivery_failed_channels: {
      type: [String],
      enum: ['in_app', 'push', 'email', 'sms'],
      default: [],
    },
    metadata: {
      type: Object,
      required: false,
    },
    action_url: {
      type: String,
      required: false,
    },
    expires_at: {
      type: Date,
      required: false,
    },
    archived: {
      type: Boolean,
      default: false,
    },
    archived_at: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes for efficient queries
NotificationSchema.index({ user: 1, createdAt: -1 })
NotificationSchema.index({ user: 1, read: 1 })
NotificationSchema.index({ expires_at: 1 }, { sparse: true })
NotificationSchema.index({ trigger: 1 }, { sparse: true })
NotificationSchema.index({ session: 1 }, { sparse: true })
NotificationSchema.index({ user: 1, archived: 1 })

export const Notification = model<NotificationDocument>(
  'usernotifications',
  NotificationSchema,
)
