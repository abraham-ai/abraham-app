import { Schema, model } from 'mongoose'

export interface DiscordAgentSchema {
  agentId: string
  channelId: string
  createdAt: Date
  updatedAt: Date
}

export interface DiscordAgentDocument extends DiscordAgentSchema {}

export const discordAgentSchema = new Schema<DiscordAgentDocument>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'agents',
      required: true,
    },
    channelId: {
      type: String,
      required: true,
      maxlength: 80,
    },
  },
  {
    timestamps: true,
  },
)

export const DiscordAgent = model<DiscordAgentDocument>(
  'discordagents',
  discordAgentSchema,
)
