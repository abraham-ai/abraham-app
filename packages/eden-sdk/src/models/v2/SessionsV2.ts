import {
  ListQueryParams,
  PaginatedResponse,
  WebAPICallOptions,
  WebAPICallResult,
  transformArgsIntoURLParams,
} from '../../types'
import { Creator } from '../Creators'
import { Agent } from './Agents'
import { Message } from './Messages'
import { AxiosRequestConfig } from 'axios'

// Arguments
export interface SessionsV2CreateArguments extends WebAPICallOptions {
  agent_ids: string[]
  scenario?: string
  budget?: {
    manna_budget?: number
    token_budget?: number
    turn_budget?: number
  }
  title?: string
  autonomy_settings?: {
    auto_reply: boolean
    reply_interval: number
    actor_selection_method: 'random' | 'random_exclude_last'
  }
}

export interface SessionsV2MessageArguments extends WebAPICallOptions {
  session_id?: string // If not provided, will create a new session
  content: string
  attachments?: string[]
  // Creation args (used when session_id is not provided)
  agent_ids?: string[]
  scenario?: string
  budget?: {
    manna_budget?: number
    token_budget?: number
    turn_budget?: number
  }
  title?: string
  autonomy_settings?: {
    auto_reply: boolean
    reply_interval: number
    actor_selection_method: 'random' | 'random_exclude_last'
  }
}

export interface SessionsV2MessageReactArguments extends WebAPICallOptions {
  message_id: string
  reaction: 'thumbs_up' | 'thumbs_down' | 'pin'
}

export interface SessionsV2ListArguments
  extends WebAPICallOptions,
    ListQueryParams {
  user_id?: string
  agent_id?: string
}

export interface SessionsV2GetArguments extends WebAPICallOptions {
  session_id: string
}

export interface SessionsV2DeleteArguments extends WebAPICallOptions {
  session_id: string
}

export interface SessionsV2RenameArguments extends WebAPICallOptions {
  session_id: string
  title: string
}

export interface SessionsV2CancelArguments extends WebAPICallOptions {
  session_id: string
  tool_call_id?: string
  tool_call_index?: number
}

export interface SessionsV2ShareCreateArguments extends WebAPICallOptions {
  session_id: string
  message_id: string
  title?: string
}

export interface SessionsV2ShareGetArguments extends WebAPICallOptions {
  share_id: string
}

export interface SessionsV2ShareDeleteArguments extends WebAPICallOptions {
  share_id: string
}

// Requests
export const sessionsCreateRequestConfigV2 = (
  args: SessionsV2CreateArguments,
): AxiosRequestConfig => {
  return {
    method: 'POST',
    url: 'v2/sessions/create',
    data: {
      ...args,
    },
  }
}

export const sessionsMessageRequestConfigV2 = (
  args: SessionsV2MessageArguments,
): AxiosRequestConfig => {
  return {
    method: 'POST',
    url: 'v2/sessions',
    data: {
      ...args,
    },
  }
}

export const sessionsMessageReactRequestConfigV2 = (
  args: SessionsV2MessageReactArguments,
): AxiosRequestConfig => {
  return {
    method: 'POST',
    url: 'v2/sessions/react',
    data: {
      ...args,
    },
  }
}

export const sessionsListRequestConfigV2 = (
  args: SessionsV2ListArguments,
): AxiosRequestConfig => {
  const params = transformArgsIntoURLParams(args)
  return {
    method: 'GET',
    url: 'v2/sessions',
    params,
  }
}

export const sessionsGetRequestConfigV2 = (
  args: SessionsV2GetArguments,
): AxiosRequestConfig => {
  return {
    method: 'GET',
    url: `v2/sessions/${args.session_id}`,
  }
}

export const sessionsDeleteRequestConfigV2 = (
  args: SessionsV2DeleteArguments,
): AxiosRequestConfig => {
  return {
    method: 'DELETE',
    url: `v2/sessions/${args.session_id}`,
  }
}

export const sessionsRenameRequestConfigV2 = (
  args: SessionsV2RenameArguments,
): AxiosRequestConfig => {
  return {
    method: 'PATCH',
    url: `v2/sessions/${args.session_id}`,
    data: {
      title: args.title,
    },
  }
}

export const sessionsCancelRequestConfigV2 = (
  args: SessionsV2CancelArguments,
): AxiosRequestConfig => {
  return {
    method: 'POST',
    url: `v2/sessions/${args.session_id}/cancel`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      ...(args.tool_call_id && { tool_call_id: args.tool_call_id }),
      ...(args.tool_call_index !== undefined && {
        tool_call_index: args.tool_call_index,
      }),
    },
  }
}

export const sessionsShareCreateRequestConfigV2 = (
  args: SessionsV2ShareCreateArguments,
): AxiosRequestConfig => {
  return {
    method: 'POST',
    url: `v2/sessions/${args.session_id}/share`,
    data: {
      message_id: args.message_id,
      ...(args.title && { title: args.title }),
    },
  }
}

export const sessionsShareGetRequestConfigV2 = (
  args: SessionsV2ShareGetArguments,
): AxiosRequestConfig => {
  return {
    method: 'GET',
    url: `v2/sessions/share/${args.share_id}`,
  }
}

export const sessionsShareDeleteRequestConfigV2 = (
  args: SessionsV2ShareDeleteArguments,
): AxiosRequestConfig => {
  return {
    method: 'DELETE',
    url: `v2/sessions/share/${args.share_id}`,
  }
}

// Responses
export type SessionsV2CreateResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | {
        session: SessionV2
        success: boolean
      }
  )

export type SessionsV2MessageResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | {
        session_id: SessionV2['_id']
        message_id?: string
        success: boolean
      }
  )

export type SessionsV2MessageReactResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | { success: boolean; message?: Message }
  )

export type SessionsV2ListResponse = WebAPICallResult &
  PaginatedResponse<SessionV2> & {
    error?: string
  }

export type SessionsV2GetResponse = WebAPICallResult & {
  error?: string
  session?: SessionV2
}

export type SessionsV2DeleteResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | { success: boolean }
  )

export type SessionsV2RenameResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | { success: boolean }
  )

export type SessionsV2CancelResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | {
        status: string
        session_id: string
      }
  )

export type SessionsV2ShareCreateResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | {
        success: boolean
        share_id: string
        share_url: string
      }
  )

export type SessionsV2ShareGetResponse = WebAPICallResult & {
  error?: string
  share?: {
    share_id: string
    title?: string
    session: SessionV2
    messages: Message[]
    owner: Creator
    createdAt: Date
  }
}

export type SessionsV2ShareDeleteResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | { success: boolean }
  )

export type SessionStatus = 'active' | 'archived'

export type SessionV2 = {
  _id: string
  owner: Creator
  users?: Creator[]
  session_key?: string
  channel?: string
  parent_session?: string
  agents: Agent[]
  status: SessionStatus
  messages: Message[]
  context?: {
    memories?: string[]
    memory_updated?: string
  }
  title?: string
  scenario?: string
  autonomy_settings?: {
    auto_reply: boolean
    reply_interval: number
    actor_selection_method: 'random' | 'random_exclude_last'
  }
  last_actor_id?: string
  last_memory_message_id?: string
  budget?: {
    token_budget?: number
    manna_budget?: number
    turn_budget?: number
    tokens_spent?: number
    manna_spent?: number
    turns_spent?: number
  }
  platform?: 'discord' | 'telegram' | 'twitter' | 'farcaster'
  trigger?: string
  active_requests?: string[]
  createdAt: Date
  updatedAt: Date
}
