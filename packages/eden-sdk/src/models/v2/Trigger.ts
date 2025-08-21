import { Creator } from 'src/models'
import { Agent } from 'src/models/v2'

export type CronSchedule = {
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

export type Trigger = {
  _id: string
  trigger_id: string
  user: Creator
  agent: Agent
  session_type: 'new' | 'another'
  session?: string | null
  schedule: CronSchedule
  instruction: string
  update_config?: any
  status?: 'active' | 'paused' | 'finished'
  posting_instructions?: {
    post_to: 'same' | 'another' | 'discord' | 'telegram' | 'x' | 'farcaster'
    session_id?: string | null
    channel_id?: string | null
    custom_instructions?: string
  }
  deleted?: boolean
  last_run_time?: Date
  next_scheduled_run?: Date
  createdAt: Date
  updatedAt: Date
}
