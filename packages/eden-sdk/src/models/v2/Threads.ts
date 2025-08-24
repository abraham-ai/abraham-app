import {
  ListQueryParams,
  PaginatedResponse,
  WebAPICallOptions,
  WebAPICallResult,
  transformArgsIntoURLParams,
} from '../../types'
import { Creator } from '../Creators'
import { Agent } from './Agents'
import { TaskV2Args, TaskV2Result, TaskV2Status } from './TasksV2'
import { AxiosRequestConfig } from 'axios'

// Arguments
export interface ThreadsCreateArguments extends WebAPICallOptions {
  thread_id?: string
  agent_id: string
  content: string
  attachments?: string[]
}

export interface ThreadsMessageArguments extends WebAPICallOptions {
  thread_id?: string
  agent_id?: string
  content: string
  attachments?: string[]
}

export interface ThreadsPinMessageArguments extends WebAPICallOptions {
  message_id: string
}

export interface ThreadsUnpinMessageArguments extends WebAPICallOptions {
  message_id: string
}

export interface ThreadsMessageReactArguments extends WebAPICallOptions {
  message_id: string
  reaction: 'thumbs_up' | 'thumbs_down'
}

export interface ThreadsListArguments
  extends WebAPICallOptions,
    ListQueryParams {
  agent_id?: string
}

export interface ThreadsGetArguments extends WebAPICallOptions {
  thread_id: string
}

export interface ThreadsDeleteArguments extends WebAPICallOptions {
  thread_id: string
}

export interface ThreadsRenameArguments extends WebAPICallOptions {
  thread_id: string
  title: string
}

// Requests

export const threadsCreateRequestConfig = (
  args: ThreadsCreateArguments,
): AxiosRequestConfig => {
  return {
    method: 'POST',
    url: 'v2/threads/create',
    data: {
      ...args,
    },
  }
}

export const threadsMessageRequestConfig = (
  args: ThreadsMessageArguments,
): AxiosRequestConfig => {
  return {
    method: 'POST',
    url: 'v2/threads',
    data: {
      ...args,
    },
  }
}

export const threadsMessageReactRequestConfig = (
  args: ThreadsMessageReactArguments,
): AxiosRequestConfig => {
  return {
    method: 'POST',
    url: 'v2/threads/react',
    data: {
      ...args,
    },
  }
}

export const threadsPinMessageRequestConfig = (
  args: ThreadsPinMessageArguments,
): AxiosRequestConfig => {
  return {
    method: 'POST',
    url: 'v2/threads/pin',
    data: {
      ...args,
    },
  }
}

export const threadsUnpinMessageRequestConfig = (
  args: ThreadsUnpinMessageArguments,
): AxiosRequestConfig => {
  return {
    method: 'POST',
    url: 'v2/threads/unpin',
    data: {
      ...args,
    },
  }
}

export const threadsListRequestConfig = (
  args: ThreadsListArguments,
): AxiosRequestConfig => {
  const params = transformArgsIntoURLParams(args)
  return {
    method: 'GET',
    url: 'v2/threads',
    params,
  }
}

export const threadsGetRequestConfig = (
  args: ThreadsGetArguments,
): AxiosRequestConfig => {
  return {
    method: 'GET',
    url: `v2/threads/${args.thread_id}`,
  }
}

export const threadsDeleteRequestConfig = (
  args: ThreadsDeleteArguments,
): AxiosRequestConfig => {
  return {
    method: 'DELETE',
    url: `v2/threads/${args.thread_id}`,
  }
}

export const threadsRenameRequestConfig = (
  args: ThreadsRenameArguments,
): AxiosRequestConfig => {
  return {
    method: 'PATCH',
    url: `v2/threads/${args.thread_id}`,
    data: {
      title: args.title,
    },
  }
}

// Responses

export type ThreadsCreateResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | { thread_id?: Thread['_id']; success: boolean }
  )

export type ThreadsMessageResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | { thread_id?: Thread['_id']; success: boolean }
  )

export type ThreadsPinMessageResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | { success: boolean }
  )

export type ThreadsUnpinMessageResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | { success: boolean }
  )

export type ThreadsMessageReactResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | { success: boolean }
  )

export type ThreadsListResponse = WebAPICallResult &
  PaginatedResponse<Thread> & {
    error?: string
  }

export type ThreadsGetResponse = WebAPICallResult & {
  error?: string
  thread?: Thread
}

export type ThreadsDeleteResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | { success: boolean }
  )

export type ThreadsRenameResponse = WebAPICallResult &
  (
    | {
        error?: string
        message?: string
      }
    | { success: boolean }
  )
// Types

export type BaseThreadMessage = {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  metadata?: { [key: string]: string | boolean | number }
  createdAt?: Date
}

export type UserMessageAttachments = string

export type ThreadUserMessage = BaseThreadMessage & {
  role: 'user'
  // name: string
  content: string
  attachments?: UserMessageAttachments[]
}

export type ToolCall = {
  id: string
  name: string
  error?: string
  status?: TaskV2Status
  tool?: string
  args: TaskV2Args
  result?: TaskV2Result[]
}

export type ThreadMessageReaction = {
  [key: string]: (string | number | boolean | Date | null)[]
}

export type ThreadMessage = {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content?: string
  reactions?: ThreadMessageReaction
  pinned?: boolean
  metadata?: {
    [key: string]: string | number | boolean | Date | null
  }
  reply_to?: string
  tool_calls?: ToolCall[]
  attachments?: string[]
  createdAt: Date
}

export type ToolResults = {
  id: string
  name: string
  result: string
  error?: string
}

export type ThreadAssistantMessage = BaseThreadMessage & {
  role: 'assistant'
  content: string
  status?: { type: 'running' | 'complete'; reason?: string }
  tool_calls?: ToolCall[]
}

export type ThreadSystemMessage = BaseThreadMessage & {
  role: 'system'
  content: string
}

export type Thread = {
  _id: string
  user: Creator
  agent: Agent
  key?: string
  title?: string
  name: string
  active?: string[] //active message.ids
  messages: (ThreadUserMessage | ThreadAssistantMessage | ThreadSystemMessage)[]
  createdAt: Date
  updatedAt: Date
}
