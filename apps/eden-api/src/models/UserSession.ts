import { Document, Schema, model } from 'mongoose'

export interface UserSessionSchema {
  user_id: string
  active_expires: number
  idle_expires: number
}

export interface UserSessionDocument extends UserSessionSchema, Document {}

const userSession = new Schema<UserSessionDocument>(
  {
    _id: {
      type: String,
      required: true,
    },
    user_id: {
      type: String,
      required: true,
    },
    active_expires: {
      type: Number,
      required: true,
    },
    idle_expires: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  },
)

export const UserSession = model<UserSessionDocument>(
  'userSessions',
  userSession,
)
