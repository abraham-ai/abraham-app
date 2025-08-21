import adminRoutes from './adminRoutes'
import apiKeyRoutes from './apiKeyRoutes'
import authRoutes from './authRoutes'
import characterRoutes from './characterRoutes'
import collectionRoutes from './collectionRoutes'
import conceptRoutes from './conceptRoutes'
import creatorRoutes from './creatorRoutes'
import feedRoutes from './feedRoutes'
import generatorRoutes from './generatorRoutes'
import mannaRoutes from './mannaRoutes'
import mediaRoutes from './mediaRoutes'
import paymentRoutes from './paymentRoutes'
import sessionRoutes from './sessionRoutes'
import testRoutes from './testRoutes'
import { TSchema, Type } from '@sinclair/typebox'

export const paginatedResponse = (docs: TSchema) => {
  return Type.Object({
    docs: Type.Array(docs),
    total: Type.Number(),
    limit: Type.Number(),
    pages: Type.Number(),
    page: Type.Number(),
    pagingCounter: Type.Number(),
    hasPrevPage: Type.Boolean(),
    hasNextPage: Type.Boolean(),
    prevPage: Type.Optional(Type.Number()),
    nextPage: Type.Optional(Type.Number()),
  })
}

export const cursorPaginatedResponse = (docs: TSchema) => {
  return Type.Object({
    docs: Type.Array(docs),
    nextCursor: Type.Optional(Type.Any()),
  })
}

const basePaginationProperties = {
  orderBy: { type: 'string' },
  direction: { type: 'number' },
  limit: { type: 'number' },
}

const baseCursorPaginationProperties = {
  sort: { type: ['string', 'array'] },
  limit: { type: 'number' },
  filter: { type: ['string', 'array'] },
  search: { type: 'string' },
}

export const paginationProperties = () => {
  return {
    page: { type: 'number' },
    ...basePaginationProperties,
  }
}

export const cursorPaginationProperties = () => {
  return {
    cursor: { type: 'string' },
    ...baseCursorPaginationProperties,
  }
}

export const routes = [
  adminRoutes,
  characterRoutes,
  authRoutes,
  mannaRoutes,
  apiKeyRoutes,
  mediaRoutes,
  creatorRoutes,
  collectionRoutes,
  generatorRoutes,
  conceptRoutes,
  feedRoutes,
  sessionRoutes,
  paymentRoutes,
  testRoutes,
]
