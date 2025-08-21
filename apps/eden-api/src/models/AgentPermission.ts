import { AgentDocument } from './Agent'
import { UserDocument } from './User'
import { Document, Schema, model } from 'mongoose'

export enum PermissionLevel {
  Editor = 'editor',
  Owner = 'owner',
}

export interface AgentPermissionSchema {
  agent: AgentDocument['_id']
  user: UserDocument['_id']
  level: PermissionLevel
  grantedBy: UserDocument['_id']
  grantedAt: Date
}

export interface AgentPermissionDocument
  extends AgentPermissionSchema,
    Document {}

const AgentPermissionSchema = new Schema<AgentPermissionDocument>(
  {
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
    level: {
      type: String,
      enum: Object.values(PermissionLevel),
      required: true,
    },
    grantedBy: {
      type: Schema.Types.ObjectId,
      ref: 'users3',
      required: true,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Compound index for unique user-agent pairs
AgentPermissionSchema.index({ agent: 1, user: 1 }, { unique: true })

// Index for querying all permissions for a specific agent
AgentPermissionSchema.index({ agent: 1, level: 1 })

// Index for querying all agents shared with a specific user
AgentPermissionSchema.index({ user: 1, level: 1 })

// Index for querying by permission level
AgentPermissionSchema.index({ level: 1 })

export const AgentPermission = model<AgentPermissionDocument>(
  'agent_permissions',
  AgentPermissionSchema,
)
