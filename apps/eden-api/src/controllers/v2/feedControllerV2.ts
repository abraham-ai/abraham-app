import { AUDIO_MIME_TYPES, VIDEO_MIME_TYPES } from '../../lib/constants'
import { IMAGE_MIME_TYPES } from '../../lib/constants'
import { getSimilarCreationIds } from '../../lib/similar'
import { Agent } from '../../models/Agent'
import { Embedding, EmbeddingDocument } from '../../models/Embedding'
import { User } from '../../models/User'
import {
  CollectionV2,
  CollectionV2Document,
} from '../../models/v2/CollectionV2'
import { CreationV2, CreationV2Document } from '../../models/v2/CreationV2'
import { ModelV2, ModelV2Document } from '../../models/v2/ModelV2'
import { TaskV2 } from '../../models/v2/TaskV2'
import {
  forceCloudfrontUrl,
  s3ThumbnailUrl,
  s3Url,
} from '../../plugins/s3Plugin'
import {
  CursorPaginatedFeedQuery,
  FeedAgentCursorResponse,
  FeedCreatorCursorResponse,
  ReactionType,
} from '@edenlabs/eden-sdk'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ObjectId } from 'mongodb'
import { Expression, PipelineStage } from 'mongoose'

const emptyPaginatedResponse = {
  docs: [],
}

type FeedResponse<T> = {
  docs: T
  reactions: { [key: string]: Map<ReactionType, boolean> } | []
  bookmarks: { [key: string]: boolean } | []
  nextValue?: number
  nextCursor?: string
}

type SortOptions = Record<string, 1 | -1 | Expression.Meta>
type Filter =
  | Array<{ $lte?: Date; $gte?: Date }>
  | string
  | string[]
  | number
  | boolean
  | ObjectId
  | ObjectId[]
  | Date
  | {
      $in?: string | string[] | ObjectId[]
      $eq?:
        | boolean
        | {
            $lte?: Date | undefined
            $gte?: Date | undefined
          }
        | string
        | ObjectId
      $exists?: boolean | string | ObjectId
      $or?: []
    }
type Filters = Record<string, Filter>

interface QueryOptions {
  cursor?: string
  projection?: Record<string, 1 | -1 | Expression.Meta>
  sortCursor?:
    | { likeCount: { $lte?: number } }
    | { creationCount: { $lte?: number } }
    | { followerCount: { $lte?: number } }
  limit?: number
  filters?: Filters
  preAggregate?: []
  sortOptions?: SortOptions
}

type FilterItem = {
  name: string
  value: string | number | boolean
}

type CustomFilters = {
  'mediaAttributes.mimeType'?: {
    $in: (
      | string
      | ObjectId
      | { $lte?: Date | undefined; $gte?: Date | undefined }
      | { $exists: true }
      | { $gt: 0 }
      | { $in?: string[] | ObjectId[] | undefined }
    )[]
  }
  tool?:
    | string
    | ObjectId
    | ObjectId[]
    | string[]
    | {
        $in:
          | string[]
          | (
              | { $lte?: Date | undefined; $gte?: Date | undefined }
              | { $exists: true }
              | string
              | ObjectId
            )[]
      }
  public?: boolean
  maxDate?: Date | undefined
  minDate?: Date | undefined
  likeCount?: { $gt?: number }
  creationCount?: { $gt?: number }
  followerCount?: { $gt?: number }
  createdAt?: Filter
  _id?: string | ObjectId | { $in?: string[] | ObjectId[] }
  $or?: { user: { $ne?: ObjectId; $eq?: ObjectId }; public: boolean }[]
}

type GenericFilters = {
  _id?: ObjectId
  user?: ObjectId
  creation?: ObjectId
  character?: ObjectId
  concept?: ObjectId
  collection?: ObjectId
  'args.lora'?: string
  'result.output.creation'?: { $exists: true }
}

const createCursorMatch = (cursor: string) => {
  // If a cursor is provided, convert it to an ObjectId, otherwise match all
  const lastSeenIdMatch = cursor ? { _id: { $lt: new ObjectId(cursor) } } : {}
  return Object.keys(lastSeenIdMatch).length > 0 ? [lastSeenIdMatch] : []
}

const maybeAddCursorFilterStage = (
  cursor?: string,
  filters?: Filters,
): PipelineStage | undefined => {
  const match = cursor
    ? {
        $and: [
          // only add _id match-filter if cursor is defined
          ...createCursorMatch(cursor),
          { ...filters },
        ],
      }
    : {
        ...filters,
      }

  return Object.keys(match).length ? { $match: match } : undefined
}

const creationsLookup = (
  localField: string,
  foreignField: string,
  lookupPipeline: PipelineStage[],
) => {
  return [
    {
      $lookup: {
        from: 'creations3',
        localField: localField,
        foreignField: foreignField,
        pipeline: lookupPipeline,
        as: 'creations',
      },
    },
    {
      $unwind: {
        path: '$creations',
      },
    },
    {
      $replaceRoot: {
        newRoot: '$creations',
      },
    },
  ]
}

const collectionsPreAggregatePipeline = (
  matchStage: PipelineStage[],
  lookupPipeline: PipelineStage[],
) => {
  return [
    ...matchStage,
    // {
    //   $project: {
    //     creations: 1,
    //   },
    // },
    ...creationsLookup('creations', '_id', lookupPipeline),
    // {
    //   $sort: {
    //     _id: -1,
    //   },
    // },
  ]
}

const tasksPreAggregatePipeline = (
  matchStage: PipelineStage[],
  lookupPipeline: PipelineStage[],
) => {
  return [
    ...matchStage,
    // {
    //   $project: {
    //     creations: 1,
    //   },
    // },
    ...creationsLookup('result.output.creation', '_id', lookupPipeline),
    // {
    //   $sort: {
    //     _id: -1,
    //   },
    // },
  ]
}

const handleArguments = async ({
  server,
  reply,
  authUserId,
  query,
  usesPrivacy = true,
}: {
  server: FastifyInstance
  reply: FastifyReply
  authUserId?: ObjectId
  query?: CursorPaginatedFeedQuery
  usesPrivacy?: boolean
}) => {
  const { filter, sort } = query || {}

  const filterMap: FilterItem[] = []
  if (filter) {
    (Array.isArray(filter) ? filter : [filter]).map(filterGroup => {
      const [filterItem, filterValue] = filterGroup.split(';')
      filterMap.push({ name: filterItem, value: filterValue })
    })
  }

  const usesLikedFilter = filterMap
    ? filterMap.filter(item => item.name === 'likedBy').length > 0
    : undefined
  // console.log({usesLikedFilter})

  // if using "likedBy me" filter: remove default privacy filter as we'll need to handle that conditionally based on creation.user
  if (usesLikedFilter) {
    const indexPrivacyParam = filterMap.findIndex(
      item => item.name === 'public',
    )
    if (filterMap[indexPrivacyParam] !== undefined) {
      delete filterMap[indexPrivacyParam]
    }
  }

  const filterUserIds = filterMap
    ? filterMap
        ?.filter(
          item =>
            (item.name === 'user' && item.value === authUserId?.toString()) ||
            (item.name === 'owner' && item.value === authUserId?.toString()) ||
            (item.name === 'agent' && item.value === authUserId?.toString()),
        )
        .map(item => item.value)
    : undefined

  const isUserRequestingOwnProfileFeed =
    filterUserIds && filterUserIds.length === 1 && authUserId
      ? authUserId.toString() === filterUserIds[0].toString()
      : false
  // console.log({ filterMap })
  // console.log({ authUserId, filterUserIds, isUserRequestingOwnProfileFeed })

  let useReactionsPreAggregate = false
  let useEmbeddingsPreAggregate = false
  let useCollectionsPreAggregate = false
  let useTasksPreAggregate = false
  let useFollowingPreAggregate = false
  const preAggregateFilterOptions: GenericFilters = {}
  const customFilterOptions: {
    search?: string
    tool?: string[]
    base_model?: string[] | string
    _id?: string[] | ObjectId[] | string | ObjectId
    output_type?: string[]
    createdAt?: { $lte?: Date; $gte?: Date }
    'embedding.score'?: { $exists: true }
    likeCount?: { $gt: 0 }
    creationCount?: { $gt: 0 }
    followerCount?: { $gt: 0 }
    creation?: ObjectId
    $or?: { user?: { $ne?: ObjectId; $eq?: ObjectId }; public: boolean }[]
  } = {}

  const sortOptions = sort
    ? (Object.fromEntries(
        (Array.isArray(sort) ? sort : [sort])
          .map(sortOption => {
            const [field, direction] = sortOption.split(';')

            if (field === 'likeCount') {
              return ['likeCount', Number(direction)]
            }

            if (field === 'creationCount') {
              customFilterOptions['creationCount'] = { $gt: 0 }
              return ['creationCount', Number(direction)]
            }

            if (field === 'followerCount') {
              customFilterOptions['followerCount'] = { $gt: 0 }
              return ['followerCount', Number(direction)]
            }

            if (field === 'liked') {
              useReactionsPreAggregate = true
              return []
            }

            if (field === 'following') {
              useFollowingPreAggregate = true
              return []
            }

            if (field === 'wow') {
              return []
            }

            if (field === 'embedding.score') {
              useEmbeddingsPreAggregate = true //@todo: handle aggregation below
              return ['embedding.score_adjusted', Number(direction)]
            }

            if (field === 'likeCount') {
              return ['likeCount', Number(direction)]
            }

            return [field, Number(direction)]
          })
          .filter(item => item.length !== 0),
      ) as SortOptions)
    : undefined

  const filterOptions = filter
    ? (Object.fromEntries(
        (Array.isArray(filter) ? filter : [filter]).map(filterOption => {
          const [field, value] = filterOption.split(';')
          // console.log({filterOption, field, value})

          if (field === 'search') {
            customFilterOptions['search'] = value
            return []
          }

          if (
            field === 'user' ||
            field === 'owner' ||
            field === 'character' ||
            field === 'concept' ||
            field === 'collection' ||
            field === 'agent'
          ) {
            // console.log(field, value)
            if (field === 'collection') {
              useCollectionsPreAggregate = true
              preAggregateFilterOptions['_id'] = new ObjectId(value)
              return []
            }

            if (field === 'concept') {
              useTasksPreAggregate = true
              preAggregateFilterOptions['args.lora'] = value
              preAggregateFilterOptions['result.output.creation'] = {
                $exists: true,
              }

              return []
            }

            return [field, new ObjectId(value)]
          }

          if (field === 'creation') {
            customFilterOptions['creation'] = new ObjectId(value)
            return []
          }

          if (field === 'likedBy') {
            useReactionsPreAggregate = true
            preAggregateFilterOptions['user'] = new ObjectId(value)
            customFilterOptions['$or'] = [
              { user: { $ne: new ObjectId(value) }, public: true },
              { user: { $eq: new ObjectId(value) }, public: false },
            ]
            return []
          }

          if (field === 'likeCount') {
            customFilterOptions['likeCount'] = { $gt: 0 }
            return []
          }

          if (field === 'tool') {
            customFilterOptions.tool = [
              value,
              ...(customFilterOptions['tool'] || []),
            ]

            return []
          }

          if (field === 'base_model') {
            if (!customFilterOptions['base_model']) {
              customFilterOptions['base_model'] = [value]
            } else {
              // @ts-ignore
              customFilterOptions['base_model'].push(value)
            }
            return []
          }

          if (field === '_id') {
            if (!customFilterOptions['_id']) {
              customFilterOptions['_id'] = [value]
            } else {
              // @ts-ignore
              customFilterOptions['_id'].push(value)
            }
            return []
          }

          if (field === 'output_type') {
            const mimeTypes =
              value === 'image'
                ? IMAGE_MIME_TYPES
                : value === 'audio'
                ? AUDIO_MIME_TYPES
                : VIDEO_MIME_TYPES

            customFilterOptions.output_type = [
              ...mimeTypes,
              ...(customFilterOptions['output_type'] || []),
            ]

            return []
          }

          if (field === 'public') {
            if (!usesLikedFilter && isUserRequestingOwnProfileFeed) {
              return [field, value === 'true']
            }
            return []
          }
          if (field === 'minDate' && value) {
            if (!customFilterOptions['createdAt']) {
              customFilterOptions['createdAt'] = {}
            }
            //@ts-ignore
            customFilterOptions['createdAt']['$gte'] = new Date(value)
            return []
          }

          if (field === 'maxDate') {
            if (!customFilterOptions['createdAt']) {
              customFilterOptions['createdAt'] = {}
            }
            customFilterOptions['createdAt']['$lte'] = new Date(value)
            return []
          }

          return [field, value]
        }),
      ) as Filters)
    : undefined

  // console.log({ filterOptions, sortOptions })

  if (customFilterOptions.creation) {
    const embeddingDoc = (await Embedding.findOne({
      creation: new ObjectId(customFilterOptions.creation),
    }).lean()) as EmbeddingDocument

    try {
      if (embeddingDoc?.embedding?.length) {
        const similarCreationIds = await getSimilarCreationIds(
          server,
          embeddingDoc.embedding,
        )
        customFilterOptions['_id'] = {
          // @ts-ignore
          $in: similarCreationIds.map(item => new ObjectId(item)),
        }
      } else {
        return reply.status(200).send(emptyPaginatedResponse)
      }
    } catch (e) {
      console.log('Error fetching chroma embeddings', e)
      return reply.status(200).send(emptyPaginatedResponse)
    }
  }

  const customFilterMap: CustomFilters = {}

  for (const [fieldName, fieldValues] of Object.entries(customFilterOptions)) {
    if (fieldValues === undefined) continue

    if (fieldName === 'output_type') {
      customFilterMap['mediaAttributes.mimeType'] = {
        // @ts-ignore
        $in: fieldValues,
      }
    } else if (fieldName === 'tool') {
      // @ts-ignore
      customFilterMap['tool'] = {
        $in: fieldValues,
      }
    } else if (fieldName === 'base_model') {
      // @ts-ignore
      customFilterMap['base_model'] = {
        $in: Array.isArray(fieldValues)
          ? fieldValues.map(val => val)
          : [fieldValues],
      }
    } else if (
      !usesLikedFilter &&
      fieldName === 'public' &&
      isUserRequestingOwnProfileFeed
    ) {
      customFilterMap['public'] = String(fieldValues) === 'false'
    } else if (fieldName === 'likeCount') {
      customFilterMap['likeCount'] = { $gt: 0 }
    } else if (fieldName === 'creationCount') {
      customFilterMap['creationCount'] = { $gt: 0 }
    } else if (fieldName === 'followerCount') {
      customFilterMap['followerCount'] = { $gt: 0 }
    } else if (fieldName === 'createdAt') {
      //@ts-ignore
      customFilterMap['createdAt'] = fieldValues
    } else if (fieldName === '_id') {
      // @ts-ignore
      customFilterMap['_id'] = {
        $in: Array.isArray(fieldValues)
          ? // @ts-ignore
            fieldValues.map(val => new ObjectId(val))
          : // @ts-ignore
            [new ObjectId(fieldValues)],
      }
    } else if (fieldName === '$or') {
      // @ts-ignore
      customFilterMap['$or'] = fieldValues
    }

    // console.log({fieldName, fieldValues})
  }

  const collectionFilter = filterMap?.filter(
    item => item.name === 'collection',
  )[0]
  const collection = collectionFilter
    ? await CollectionV2.findById(collectionFilter.value)
    : undefined

  const defaultPrivacyFilter =
    !usesLikedFilter &&
    usesPrivacy &&
    !isUserRequestingOwnProfileFeed &&
    !(
      collection &&
      collection.user &&
      authUserId &&
      collection.user.toString() === authUserId.toString()
    )
      ? { public: { $eq: true } }
      : undefined

  const defaultDeletedFilter = usesPrivacy
    ? { deleted: { $eq: false } }
    : undefined

  const filters = {
    ...defaultPrivacyFilter,
    ...defaultDeletedFilter,
    ...customFilterMap,
    ...filterOptions,
  }

  // console.log('feedCursorController', JSON.stringify(filters))

  return {
    filters: filters || {},
    sortOptions,
    customFilterOptions,
    filterMap,
    preAggregateFilterOptions,
    useReactionsPreAggregate,
    useEmbeddingsPreAggregate,
    useCollectionsPreAggregate,
    useFollowingPreAggregate,
    useTasksPreAggregate,
  }
}

const createPipeline = async (
  options: QueryOptions = {},
): Promise<PipelineStage[]> => {
  const { cursor, sortCursor, limit, filters, projection, sortOptions } =
    options
  const pipeline: PipelineStage[] = []

  if (cursor) {
    const idCursor =
      sortCursor !== undefined
        ? { _id: { $lt: new ObjectId(cursor) } }
        : { _id: { $lt: new ObjectId(cursor) } }
    pipeline.push(
      //@ts-ignore
      sortCursor !== undefined
        ? { $match: { $and: [sortCursor, idCursor, filters] } }
        : { $match: { ...idCursor, ...filters } },
    )
  } else if (filters) {
    pipeline.push({ $match: filters })
  }

  if (sortOptions) {
    pipeline.push({ $sort: sortOptions })
  }

  if (limit) {
    pipeline.push({ $limit: limit })
  }

  if (projection) {
    pipeline.push({ $project: projection })
  }

  // console.log(JSON.stringify(pipeline, null, 2))

  return pipeline
}

const userLookup: PipelineStage[] = [
  {
    $lookup: {
      from: 'users3',
      localField: 'user',
      foreignField: '_id',
      as: 'user',
      pipeline: [
        {
          $project: {
            _id: 1,
            userId: 1,
            username: 1,
            userImage: 1,
          },
        },
      ],
    },
  },
  { $unwind: '$user' },
]

const likesLookup = (userId: ObjectId, entityType: string): PipelineStage[] => [
  {
    $lookup: {
      from: 'likes3',
      let: { entityId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$entityId', '$$entityId'] },
                { $eq: ['$user', userId] },
                { $eq: ['$entityType', entityType] },
              ],
            },
          },
        },
      ],
      as: 'likes',
    },
  },
  {
    $addFields: {
      isLiked: { $gt: [{ $size: '$likes' }, 0] },
    },
  },
  {
    $project: {
      likes: 0,
    },
  },
]

const agentLookup: PipelineStage[] = [
  {
    $lookup: {
      from: 'users3',
      localField: 'agent',
      foreignField: '_id',
      as: 'agent',
      pipeline: [
        {
          $project: {
            _id: 1,
            userId: 1,
            username: 1,
            userImage: 1,
          },
        },
      ],
    },
  },
  { $unwind: '$user' },
]

const taskLookup: PipelineStage[] = [
  {
    $lookup: {
      from: 'tasks3',
      localField: 'task',
      foreignField: '_id',
      as: 'task',
      pipeline: [
        {
          $project: {
            _id: 1,
            args: 1,
            status: 1,
          },
        },
      ],
    },
  },
  { $unwind: '$task' },
]

const ownerLookup: PipelineStage[] = [
  {
    $lookup: {
      from: 'users3',
      localField: 'owner',
      foreignField: '_id',
      as: 'owner',
      pipeline: [
        {
          $project: {
            _id: 1,
            userId: 1,
            username: 1,
            userImage: 1,
          },
        },
      ],
    },
  },
  { $unwind: '$owner' },
]

const creationLookup: PipelineStage[] = [
  {
    $lookup: {
      from: 'creations3',
      localField: 'coverCreation',
      foreignField: '_id',
      as: 'coverCreation',
      pipeline: [
        {
          $project: {
            _id: 1,
            filename: 1,
          },
        },
      ],
    },
  },
  { $unwind: { path: '$coverCreation', preserveNullAndEmptyArrays: true } },
]

export const getCreationsFeedCursorV2 = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { query } = request
  const { userId: authUserId } = request.user || {}
  // const currentDate = new Date()

  const {
    filters,
    sortOptions,
    customFilterOptions,
    // filterMap,
    preAggregateFilterOptions,
    // useReactionsPreAggregate,
    // useEmbeddingsPreAggregate,
    useCollectionsPreAggregate,
    useTasksPreAggregate,
    // useFollowingPreAggregate,
  } = await handleArguments({
    server,
    reply,
    authUserId,
    query: query as CursorPaginatedFeedQuery,
  })

  // console.log(JSON.stringify(filters, null, 2))

  const { cursor, nextValue, limit } = query as CursorPaginatedFeedQuery

  let results = []
  const lateLookupStages = [
    ...userLookup,
    ...agentLookup,
    ...(authUserId ? likesLookup(new ObjectId(authUserId), 'creation') : []),
  ]

  // console.log(
  //   JSON.stringify(
  //     { useCollectionsPreAggregate, filters, preAggregateFilterOptions },
  //     null,
  //     2,
  //   ),
  // )

  if (useCollectionsPreAggregate) {
    const lookupPipeline = await createPipeline({
      // @ts-ignore
      filters,
      sortOptions,
    })
    const pipeline = [
      ...collectionsPreAggregatePipeline(
        [{ $match: preAggregateFilterOptions }],
        lookupPipeline,
      ),
      maybeAddCursorFilterStage(cursor),
      { $limit: limit ?? 100 },
      ...lateLookupStages,
    ].filter(Boolean)

    // console.log(JSON.stringify(pipeline, null, 2))

    // @ts-ignore
    results = await CollectionV2.aggregate(pipeline)
  } else if (useTasksPreAggregate) {
    const lookupPipeline = await createPipeline({
      // @ts-ignore
      filters,
      sortOptions,
    })
    const pipeline = [
      ...tasksPreAggregatePipeline(
        [{ $match: preAggregateFilterOptions }],
        lookupPipeline,
      ),
      maybeAddCursorFilterStage(cursor),
      { $limit: limit ?? 100 },
      ...lateLookupStages,
    ].filter(Boolean)

    // console.log(JSON.stringify(pipeline, null, 2))

    // @ts-ignore
    results = await TaskV2.aggregate(pipeline)
  } else {
    const pipeline = await createPipeline({
      limit: limit ?? 100,
      sortOptions: { ...sortOptions, _id: -1 },
      sortCursor:
        customFilterOptions.likeCount && nextValue !== undefined
          ? { likeCount: { $lte: nextValue } }
          : undefined,
      cursor,
    })

    // currentDate.setMinutes(0, 0, 0)
    // const minDateDefault = new Date(currentDate)
    // minDateDefault.setHours(currentDate.getHours() - hoursAgo)
    // minDateDefault.setMinutes(0, 0, 0)
    // const maxDate = filterMap
    //   ? filterMap.filter(item => item.name === 'maxDate')[0]
    //   : undefined
    // const minDate = filterMap
    //   ? filterMap.filter(item => item.name === 'minDate')[0]
    //   : undefined
    // const embeddingsFilter = {
    //   ...filters,
    //   createdAt: {
    //     $gte: minDate ? minDate.value : minDateDefault,
    //     $lte: maxDate ? maxDate?.value : undefined,
    //   },
    //   'embedding.score': {
    //     $exists: true,
    //   },
    // }

    // let embeddingsTransform: PipelineStage[] = []
    const creationFeedPipeline = [
      // @ts-ignore
      // { $match: useEmbeddingsPreAggregate ? embeddingsFilter : filters },
      { $match: filters },
      //   ...embeddingsTransform,
      ...pipeline,
      ...lateLookupStages,
    ].filter(Boolean)

    results = await CreationV2.aggregate(creationFeedPipeline)
  }

  const feed: FeedResponse<CreationV2Document[]> = {
    docs: results,
    reactions: [],
    bookmarks: [],
  }

  try {
    feed.nextCursor =
      results && results.length && results[results.length - 1]._id

    if (customFilterOptions.likeCount) {
      feed.nextValue =
        results && results.length && results[results.length - 1].likeCount
    }

    feed.docs.forEach(doc => {
      if (doc) {
        doc.url = s3Url(server, doc.filename || '')
        doc.thumbnail = s3ThumbnailUrl(server, doc.filename || '', 1024)
      }
    })

    reply.send(feed)
  } catch {
    reply.code(500).send({ error: 'Internal Server Error' })
  }
}

export const getModelsFeedCursorV2 = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { query } = request
  const { userId: authUserId } = request.user || {}
  // const currentDate = new Date()

  // console.log({ query, authUserId })

  const {
    filters,
    sortOptions,
    customFilterOptions,
    // filterMap,
    // preAggregateFilterOptions,
    // useReactionsPreAggregate,
    // useEmbeddingsPreAggregate,
    // useCollectionsPreAggregate,
    // useFollowingPreAggregate,
  } = await handleArguments({
    server,
    reply,
    authUserId,
    query: query as CursorPaginatedFeedQuery,
  })

  const { search } = customFilterOptions

  const { cursor, nextValue, limit } = query as CursorPaginatedFeedQuery

  let results = []
  // Ensure creationCount defaults to 0 for missing values
  const defaultCreationCountStage: PipelineStage[] = [
    {
      $addFields: {
        creationCount: { $ifNull: ['$creationCount', 0] },
      },
    },
  ]

  const lateLookupStages = [
    ...taskLookup,
    ...userLookup,
    ...defaultCreationCountStage,
    ...(authUserId ? likesLookup(new ObjectId(authUserId), 'model') : []),
  ]

  const pipeline = await createPipeline({
    limit: limit ?? 100,
    sortOptions: { ...sortOptions, _id: -1 },
    sortCursor:
      customFilterOptions.likeCount && nextValue !== undefined
        ? { likeCount: { $lte: nextValue } }
        : customFilterOptions.creationCount && nextValue !== undefined
        ? { creationCount: { $lte: nextValue } }
        : undefined,
    cursor,
  })

  // const hoursAgo = 360
  // currentDate.setMinutes(0, 0, 0)
  // const minDateDefault = new Date(currentDate)
  // minDateDefault.setHours(currentDate.getHours() - hoursAgo)
  // minDateDefault.setMinutes(0, 0, 0)
  // const maxDate = filterMap
  //   ? filterMap.filter(item => item.name === 'maxDate')[0]
  //   : undefined
  // const minDate = filterMap
  //   ? filterMap.filter(item => item.name === 'minDate')[0]
  //   : undefined
  // const embeddingsFilter = {
  //   ...filters,
  //   createdAt: {
  //     $gte: minDate ? minDate.value : minDateDefault,
  //     $lte: maxDate ? maxDate?.value : undefined,
  //   },
  //   'embedding.score': {
  //     $exists: true,
  //   },
  // }

  const feedPipeline: PipelineStage[] = []

  if (search) {
    feedPipeline.push({
      $search: {
        index: 'name',
        compound: {
          should: [
            {
              autocomplete: {
                query: search,
                path: 'name',
              },
            },
            {
              text: {
                query: search,
                path: 'name',
                fuzzy: {
                  maxEdits: 2,
                },
              },
            },
            {
              autocomplete: {
                query: search,
                path: 'name',
              },
            },
            {
              text: {
                query: search,
                path: 'name',
                fuzzy: {
                  maxEdits: 2,
                },
              },
            },
          ],
          minimumShouldMatch: 1,
        },
      },
    })
  }

  feedPipeline.push({ $match: filters }, ...pipeline, ...lateLookupStages)

  // console.log(JSON.stringify(feedPipeline, null, 2))

  results = await ModelV2.aggregate(feedPipeline)

  const feed: FeedResponse<ModelV2Document[]> = {
    docs: results,
    reactions: [],
    bookmarks: [],
  }

  try {
    feed.nextCursor =
      results && results.length && results[results.length - 1]._id

    if (customFilterOptions.likeCount) {
      feed.nextValue =
        results && results.length && results[results.length - 1].likeCount
    }

    if (customFilterOptions.creationCount) {
      feed.nextValue =
        results && results.length && results[results.length - 1].creationCount
    }

    feed.docs.forEach(doc => {
      if (doc && doc.thumbnail) {
        doc.thumbnail = s3ThumbnailUrl(server, doc.thumbnail || '', 1024)
      }
    })

    reply.send(feed)
  } catch {
    reply.code(500).send({ error: 'Internal Server Error' })
  }
}

export const getCollectionsFeedCursorV2 = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { query } = request
  const { userId: authUserId } = request.user || {}

  const {
    filters,
    sortOptions,
    customFilterOptions,
    // filterMap,
    // preAggregateFilterOptions,
    // useReactionsPreAggregate,
    // useEmbeddingsPreAggregate,
    // useCollectionsPreAggregate,
    // useFollowingPreAggregate,
  } = await handleArguments({
    server,
    reply,
    authUserId,
    query: query as CursorPaginatedFeedQuery,
  })

  const { cursor, nextValue, limit } = query as CursorPaginatedFeedQuery

  let results = []
  const lateLookupStages = [...userLookup, ...creationLookup]

  const pipeline = await createPipeline({
    limit: limit ?? 100,
    sortOptions: { ...sortOptions, _id: -1 },
    sortCursor:
      customFilterOptions.likeCount && nextValue !== undefined
        ? { likeCount: { $lte: nextValue } }
        : undefined,
    cursor,
  })

  // const hoursAgo = 360
  // currentDate.setMinutes(0, 0, 0)
  // const minDateDefault = new Date(currentDate)
  // minDateDefault.setHours(currentDate.getHours() - hoursAgo)
  // minDateDefault.setMinutes(0, 0, 0)
  // const maxDate = filterMap
  //   ? filterMap.filter(item => item.name === 'maxDate')[0]
  //   : undefined
  // const minDate = filterMap
  //   ? filterMap.filter(item => item.name === 'minDate')[0]
  //   : undefined
  // const embeddingsFilter = {
  //   ...filters,
  //   createdAt: {
  //     $gte: minDate ? minDate.value : minDateDefault,
  //     $lte: maxDate ? maxDate?.value : undefined,
  //   },
  //   'embedding.score': {
  //     $exists: true,
  //   },
  // }

  // let embeddingsTransform: PipelineStage[] = []
  const feedPipeline = [
    // @ts-ignore
    // { $match: useEmbeddingsPreAggregate ? embeddingsFilter : filters },
    { $match: filters },
    //   ...embeddingsTransform,
    ...pipeline,
    ...lateLookupStages,
  ].filter(Boolean)

  // console.log(JSON.stringify(feedPipeline, null, 2))

  results = await CollectionV2.aggregate(feedPipeline)

  const feed: FeedResponse<CollectionV2Document[]> = {
    docs: results,
    reactions: [],
    bookmarks: [],
  }

  try {
    feed.nextCursor =
      results && results.length && results[results.length - 1]._id

    if (customFilterOptions.likeCount) {
      feed.nextValue =
        results && results.length && results[results.length - 1].likeCount
    }

    feed.docs.forEach(doc => {
      if (doc && doc.coverCreation) {
        doc.coverCreation.thumbnail = s3ThumbnailUrl(
          server,
          doc.coverCreation.filename || '',
          1024,
        )
      }
    })

    reply.send(feed)
  } catch {
    reply.code(500).send({ error: 'Internal Server Error' })
  }
}

export const getAgentsFeedCursor = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { query } = request
  const { userId: authUserId } = request.user || {}

  const ownerQuery = query as { filter: string | string[] }
  if (ownerQuery.filter) {
    ownerQuery.filter = (
      Array.isArray(ownerQuery.filter) ? ownerQuery.filter : [ownerQuery.filter]
    ).map(fil => (fil as string).replaceAll('user;', 'owner;'))
  }

  const { filters, sortOptions, customFilterOptions } = await handleArguments({
    server,
    reply,
    authUserId,
    query: ownerQuery as unknown as CursorPaginatedFeedQuery,
  })

  const { search } = customFilterOptions

  const { cursor, limit } = query as CursorPaginatedFeedQuery

  let results = []
  const lateLookupStages = [
    ...ownerLookup,
    ...(authUserId ? likesLookup(new ObjectId(authUserId), 'agent') : []),
  ]

  const pipeline = await createPipeline({
    limit: limit ?? 100,
    sortOptions: { ...sortOptions, _id: -1 },
    cursor,
    projection: {
      _id: 1,
      owner: 1,
      name: 1,
      description: 1,
      models: 1,
      username: 1,
      userImage: 1,
      likeCount: 1,
      isLiked: 1,
      createdAt: 1,
      updatedAt: 1,
      public: 1,
      deleted: 1,
      stats: 1,
    },
  })

  const feedPipeline: PipelineStage[] = []

  if (search) {
    feedPipeline.push({
      $search: {
        index: 'user_username_name',
        compound: {
          should: [
            {
              autocomplete: {
                query: search,
                path: 'username',
              },
            },
            {
              text: {
                query: search,
                path: 'username',
                fuzzy: {
                  maxEdits: 2,
                },
              },
            },
            {
              autocomplete: {
                query: search,
                path: 'name',
              },
            },
            {
              text: {
                query: search,
                path: 'name',
                fuzzy: {
                  maxEdits: 2,
                },
              },
            },
          ],
          minimumShouldMatch: 1,
        },
      },
    })
  }

  feedPipeline.push({ $match: filters }, ...pipeline, ...lateLookupStages)

  // console.log(JSON.stringify(feedPipeline, null, 2))

  results = await Agent.aggregate(feedPipeline)

  const feed: FeedAgentCursorResponse = {
    docs: results,
  }

  try {
    feed.nextCursor =
      results && results.length && results[results.length - 1]._id

    if (customFilterOptions.createdAt) {
      feed.nextValue =
        results && results.length && results[results.length - 1].createdAt
    }

    feed.docs?.forEach(doc => {
      if (doc && doc.userImage) {
        doc.userImage = forceCloudfrontUrl(server, doc.userImage || '')
      }
    })

    reply.send(feed)
  } catch {
    reply.code(500).send({ error: 'Internal Server Error' })
  }
}

export const getCreatorsFeedCursor = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { query } = request
  const { userId: authUserId } = request.user || {}

  const { filters, sortOptions, customFilterOptions } = await handleArguments({
    server,
    reply,
    authUserId,
    query: query as CursorPaginatedFeedQuery,
    usesPrivacy: false,
  })

  const { search } = customFilterOptions

  const { cursor, limit } = query as CursorPaginatedFeedQuery

  let results = []

  const pipeline = await createPipeline({
    limit: limit ?? 100,
    sortOptions: { ...sortOptions, _id: -1 },
    cursor,
  })

  const feedPipeline: PipelineStage[] = []

  if (search) {
    feedPipeline.push({
      $search: {
        index: 'user_username_name',
        compound: {
          should: [
            {
              autocomplete: {
                query: search,
                path: 'username',
              },
            },
            {
              text: {
                query: search,
                path: 'username',
                fuzzy: {
                  maxEdits: 2,
                },
              },
            },
            {
              autocomplete: {
                query: search,
                path: 'name',
              },
            },
            {
              text: {
                query: search,
                path: 'name',
                fuzzy: {
                  maxEdits: 2,
                },
              },
            },
          ],
          minimumShouldMatch: 1,
        },
      },
    })
  }

  feedPipeline.push(
    { $match: { ...filters, userId: { $ne: null } } },
    ...pipeline,
  )

  // console.log(JSON.stringify(feedPipeline, null, 2))

  results = await User.aggregate(feedPipeline)

  const feed: FeedCreatorCursorResponse = {
    docs: results,
  }

  try {
    feed.nextCursor =
      results && results.length && results[results.length - 1]._id

    if (customFilterOptions.createdAt) {
      feed.nextValue =
        results && results.length && results[results.length - 1].createdAt
    }

    // feed.docs?.forEach(doc => {
    //   if (doc && doc.userImage) {
    //     doc.userImage = forceCloudfrontUrl(server, doc.userImage || '')
    //   }
    // })

    reply.send(feed)
  } catch {
    reply.code(500).send({ error: 'Internal Server Error' })
  }
}
