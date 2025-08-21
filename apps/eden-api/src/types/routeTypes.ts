import { Type } from '@sinclair/typebox'

export const configType = Type.Record(Type.String(), Type.Any())
export const argsType = Type.Record(Type.String(), Type.Any())
export const parameterType = Type.Array(Type.Record(Type.String(), Type.Any()))

export const populatedUserType = Type.Object({
  _id: Type.String(),
  userId: Type.String(),
  username: Type.String(),
  userImage: Type.String(),
})

export const conceptDocType = Type.Object({
  deleted: Type.Boolean(),
  isPrivate: Type.Boolean(),
  _id: Type.String(),
  user: Type.String(),
  praiseCount: Type.Number(),
  bookmarkCount: Type.Number(),
  thumbnail: Type.String(),
  name: Type.String(),
  conceptName: Type.String(),
  checkpoint: Type.String(),
  training_images: Type.Array(Type.String()),
  instance_prompt: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  __v: Type.Number(),
  creationCount: Type.Number(),
  publicName: Type.String(),
})

export const conceptType = Type.Object({
  concept: Type.Object({
    deleted: Type.Boolean(),
    isPrivate: Type.Boolean(),
    _id: Type.String(),
    user: populatedUserType,
    praiseCount: Type.Number(),
    bookmarkCount: Type.Number(),
    uri: Type.String(),
    thumbnail: Type.String(),
    name: Type.String(),
    conceptName: Type.String(),
    checkpoint: Type.String(),
    training_images: Type.Array(Type.String()),
    instance_prompt: Type.String(),
    createdAt: Type.String(),
    updatedAt: Type.String(),
    __v: Type.Number(),
    creationCount: Type.Number(),
  }),
})

export const sessionType = Type.Object({
  id: Type.String(),
  user: Type.String(),
  users: Type.Array(Type.Any()),
  characters: Type.Array(Type.Any()),
})

export const taskV2Type = Type.Object({
  _id: Type.String(),
  user: populatedUserType,
  agent: Type.Optional(Type.Any()),
  tool: Type.String(),
  cost: Type.Optional(Type.Number()),
  output_type: Type.Optional(Type.String()),
  args: Type.Any(),
  status: Type.String(),
  performance: Type.Optional(Type.Any()),
  result: Type.Optional(Type.Any()),
  model: Type.Optional(Type.Any()),
  error: Type.Optional(Type.Any()),
  progress: Type.Optional(Type.Number()),
  updatedAt: Type.Optional(Type.String()),
  createdAt: Type.Optional(Type.String()),
})

export const modelV2Type = Type.Object({
  _id: Type.String(),
  name: Type.String(),
  user: populatedUserType,
  args: Type.Any(),
  checkpoint: Type.String(),
  public: Type.Boolean(),
  slug: Type.String(),
  thumbnail: Type.String(),
  updatedAt: Type.Optional(Type.String()),
  createdAt: Type.Optional(Type.String()),
})
