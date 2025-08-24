// Request/Response types for API calls
import { WebAPICallOptions, WebAPICallResult } from '../../types'
// Request config functions
import { AxiosRequestConfig } from 'axios'
import { Creator } from 'src/models'
import { Agent } from 'src/models/v2'

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

export type Notification = {
  _id: string
  user: Creator
  type: NotificationType
  title: string
  message: string
  read: boolean
  read_at?: Date | null
  priority: NotificationPriority
  trigger?: string | null
  session?: string | null
  agent?: Agent | null
  channels: NotificationChannel[]
  delivered_channels: NotificationChannel[]
  delivery_attempted_at?: Date | null
  delivery_failed_channels: NotificationChannel[]
  metadata?: Record<string, any> | null
  action_url?: string | null
  expires_at?: Date | null
  archived: boolean
  archived_at?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface NotificationsCreateArguments extends WebAPICallOptions {
  user_id: string
  type: NotificationType
  title: string
  message: string
  priority?: NotificationPriority
  channels?: NotificationChannel[]
  trigger_id?: string
  session_id?: string
  agent_id?: string
  metadata?: Record<string, any>
  action_url?: string
  expires_at?: Date
}

export type NotificationsCreateResponse = WebAPICallResult & {
  id: string
  message: string
}

export interface NotificationsListArguments extends WebAPICallOptions {
  read?: boolean
  type?: NotificationType
  priority?: NotificationPriority
  trigger_id?: string
  session_id?: string
  limit?: number
  offset?: number
  include_archived?: boolean
}

export type NotificationsListResponse = WebAPICallResult & {
  notifications: Notification[]
  total_count: number
  unread_count: number
}

export interface NotificationsMarkReadArguments extends WebAPICallOptions {
  notification_ids?: string[]
}

export type NotificationsMarkReadResponse = WebAPICallResult & {
  marked_read_count: number
  message: string
}

export interface NotificationsCountArguments extends WebAPICallOptions {
  read?: boolean
}

export type NotificationsCountResponse = WebAPICallResult & {
  count: number
}

export interface NotificationsArchiveArguments extends WebAPICallOptions {
  notification_ids: string[]
}

export type NotificationsArchiveResponse = WebAPICallResult & {
  archived_count: number
  message: string
}

export const notificationsCreateRequestConfig = (
  args: NotificationsCreateArguments,
): AxiosRequestConfig => {
  return {
    method: 'POST',
    url: 'v2/notifications',
    data: args,
  }
}

export const notificationsListRequestConfig = (
  args: NotificationsListArguments,
): AxiosRequestConfig => {
  return {
    method: 'GET',
    url: 'v2/notifications',
    params: args,
  }
}

export const notificationsMarkReadRequestConfig = (
  args: NotificationsMarkReadArguments,
): AxiosRequestConfig => {
  return {
    method: 'PATCH',
    url: 'v2/notifications/read',
    data: args,
  }
}

export const notificationsCountRequestConfig = (
  args: NotificationsCountArguments,
): AxiosRequestConfig => {
  return {
    method: 'GET',
    url: 'v2/notifications/count',
    params: args,
  }
}

export const notificationsArchiveRequestConfig = (
  args: NotificationsArchiveArguments,
): AxiosRequestConfig => {
  return {
    method: 'PATCH',
    url: 'v2/notifications/archive',
    data: args,
  }
}
