import { Agent, AgentDocument } from './Agent'
import { AgentPermission, AgentPermissionDocument } from './AgentPermission'
import { ApiKey, ApiKeyDocument } from './ApiKey'
import { BaseUser, BaseUserDocument } from './BaseUser'
import Challenge, { ChallengeDocument } from './Challenge'
import { Character, CharacterDocument } from './Character'
import { Collection, CollectionDocument } from './Collection'
import { Concept, ConceptDocument } from './Concept'
import { Creation, CreationDocument } from './Creation'
import { Deployment, DeploymentDocument } from './Deployment'
import { DiscordAgent, DiscordAgentDocument } from './DiscordAgent'
import { Embedding, EmbeddingDocument } from './Embedding'
import { Follow, FollowDocument } from './Follow'
import { Generator, GeneratorDocument } from './Generator'
import { Manna, MannaDocument } from './Manna'
import { MannaVoucher, MannaVoucherDocument } from './MannaVoucher'
import { Reaction, ReactionDocument } from './Reaction'
import { Session, SessionDocument } from './Session'
import { SessionEvent, SessionEventDocument } from './SessionEvent'
import { Task, TaskDocument } from './Task'
import { Transaction, TransactionDocument } from './Transaction'
import { Trigger, TriggerDocument } from './Trigger'
import { User, UserDocument } from './User'
import { UserMigration, UserMigrationDocument } from './UserMigration'
import { CollectionV2Document } from './v2/CollectionV2'
import { CollectionV2 } from './v2/CollectionV2'
import { CreationLikeV2, CreationLikeV2Document } from './v2/CreationLikeV2'
import { CreationV2, CreationV2Document } from './v2/CreationV2'
import { Message, MessageDocument } from './v2/Message'
import { ModelV2, ModelV2Document } from './v2/ModelV2'
import {
  Session as SessionV2,
  SessionDocument as SessionV2Document,
} from './v2/SessionV2'
import { TaskV2, TaskV2Document } from './v2/TaskV2'
import { Thread, ThreadDocument } from './v2/Thread'
import { ToolV2, ToolV2Document } from './v2/ToolV2'
import { TransactionV2, TransactionV2Document } from './v2/TransactionV2'
import { Model } from 'mongoose'

export interface Database {
  BaseUser: Model<BaseUserDocument>
  User: Model<UserDocument>
  Agent: Model<AgentDocument>
  Manna: Model<MannaDocument>
  MannaVoucher: Model<MannaVoucherDocument>
  ApiKey: Model<ApiKeyDocument>
  Follow: Model<FollowDocument>
  Task: Model<TaskDocument>
  TaskV2: Model<TaskV2Document>
  Thread: Model<ThreadDocument>
  Creation: Model<CreationDocument>
  CreationV2: Model<CreationV2Document>
  CreationLikeV2: Model<CreationLikeV2Document>
  Deployment: Model<DeploymentDocument>
  Embedding: Model<EmbeddingDocument>
  Concept: Model<ConceptDocument>
  ModelV2: Model<ModelV2Document>
  Reaction: Model<ReactionDocument>
  Collection: Model<CollectionDocument>
  CollectionV2: Model<CollectionV2Document>
  Transaction: Model<TransactionDocument>
  Generator: Model<GeneratorDocument>
  ToolV2: Model<ToolV2Document>
  Character: Model<CharacterDocument>
  Challenge: Model<ChallengeDocument>
  Session: Model<SessionDocument>
  SessionEvent: Model<SessionEventDocument>
  UserMigration: Model<UserMigrationDocument>
  DiscordAgent: Model<DiscordAgentDocument>
  Trigger: Model<TriggerDocument>
  TransactionV2: Model<TransactionV2Document>
  Message: Model<MessageDocument>
  SessionV2: Model<SessionV2Document>
  AgentPermission: Model<AgentPermissionDocument>
}

export const models: Database = {
  BaseUser,
  User,
  Agent,
  Manna,
  MannaVoucher,
  ApiKey,
  Follow,
  Embedding,
  Task,
  TaskV2,
  Thread,
  Creation,
  CreationV2,
  CreationLikeV2,
  Concept,
  Deployment,
  ModelV2,
  Reaction,
  Collection,
  CollectionV2,
  Transaction,
  Generator,
  ToolV2,
  Character,
  Challenge,
  Session,
  SessionEvent,
  UserMigration,
  DiscordAgent,
  Trigger,
  TransactionV2,
  Message,
  SessionV2,
  AgentPermission,
}
