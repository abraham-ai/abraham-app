import { getSimilarCreationIds } from '../lib/similar'
import { Character, CharacterDocument } from '../models/Character'
import { Collection } from '../models/Collection'
import { Concept, ConceptDocument } from '../models/Concept'
import { Creation, CreationDocument } from '../models/Creation'
import { Embedding, EmbeddingDocument } from '../models/Embedding'
import { Follow } from '../models/Follow'
import { Reaction } from '../models/Reaction'
import { User, UserDocument } from '../models/User'
import CharacterRepository from '../repositories/CharacterRepository'
import ConceptRepository from '../repositories/ConceptRepository'
import CreationRepository from '../repositories/CreationRepository'
import CreatorRepository from '../repositories/CreatorRepository'
import {
  getBookmarks as getCreationBookmarks,
  getReactions as getCreationReactions,
} from './creationsController'
import {
  FeedCharactersArguments,
  FeedConceptsArguments,
  FeedCreationsArguments,
  FeedCreatorsArguments,
  PaginatedResponse,
  ReactionType,
} from '@edenlabs/eden-sdk'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ObjectId } from 'mongodb'
import mongoose, { PipelineStage } from 'mongoose'

const aggregateCreationsByFollowerId = (
  followerId: ObjectId,
  dateEndCutOff: string,
  filters: Filters,
) => {
  // console.log({ filters })
  return Follow.aggregate([
    {
      $match: {
        follower: {
          $eq: new ObjectId(followerId),
        },
        createdAt: {
          $lte: new Date(dateEndCutOff),
        },
      },
    },
    {
      $project: {
        _id: 0,
        following: 1,
      },
    },
    {
      $lookup: {
        from: 'creations',
        let: { followingId: '$following' },
        pipeline: [
          {
            $match: {
              $and: [
                { $expr: { $eq: ['$user', '$$followingId'] } },
                { isPrivate: { $eq: false } },
                { deleted: { $eq: false } },
                { ...filters },
              ],
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 100 },
        ],
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
  ])
}

const aggregateCreationsByUserLikes = (
  userId: ObjectId,
  dateEndCutOff: string,
  filters: Filters,
) => {
  return Reaction.aggregate([
    {
      $match: {
        user: {
          $eq: new ObjectId(userId),
        },
        createdAt: {
          $lte: new Date(dateEndCutOff),
        },
      },
    },
    {
      $sort: { createdAt: -1 },
    },
    {
      $project: {
        _id: 0,
        user: 1,
        creation: 1,
      },
    },
    {
      $lookup: {
        from: 'creations',
        let: { reactionsCreationId: '$creation' },
        pipeline: [
          {
            $match: {
              $and: [
                { $expr: { $eq: ['$_id', '$$reactionsCreationId'] } },
                { isPrivate: { $eq: false } },
                { deleted: { $eq: false } },
                { ...filters },
              ],
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
        ],
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
  ])
}

type Filters =
  | {
      'mediaAttributes.type'?: { $in: string | string[] } | undefined
      isPrivate?: boolean | undefined
    }
  | undefined

const aggregateCreationsByEmbeddingScore = (
  dateEndCutOff: string,
  dateStartCutOff: string | undefined,
  filters: Filters,
) => {
  const decayPerHour = 0.0015
  const hoursAgo = 360
  const currentDate = new Date()
  currentDate.setMinutes(0, 0, 0)
  const minDate = new Date(currentDate)
  minDate.setHours(currentDate.getHours() - hoursAgo)
  minDate.setMinutes(0, 0, 0)

  return Creation.aggregate([
    {
      $match: {
        createdAt: {
          $gte: dateStartCutOff || minDate,
          $lte: new Date(dateEndCutOff),
        },
        'embedding.score': { $exists: true },
        isPrivate: false,
        deleted: false,
        ...filters,
      },
    },
    {
      $set: {
        'embedding.score_age_hours': {
          $dateDiff: {
            startDate: { $toDate: '$createdAt' },
            endDate: currentDate,
            unit: 'hour',
          },
        },
      },
    },
    {
      $set: {
        'embedding.score_age_decay': {
          $multiply: ['$embedding.score_age_hours', decayPerHour],
        },
      },
    },
    {
      $set: {
        'embedding.score_adjusted': {
          $subtract: ['$embedding.score', '$embedding.score_age_decay'],
        },
      },
    },
    {
      $sort: {
        'embedding.score_adjusted': -1,
        _id: -1,
      },
    },
  ])
}

const emptyPaginatedResponse = {
  docs: [],
  total: 0,
  pages: 0,
  page: 0,
  limit: 0,
  pagingCounter: 0,
  hasPrevPage: false,
  hasNextPage: false,
  prevPage: 0,
  nextPage: 0,
}

export const getCreationsFeed = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const {
    userId: filterUserIds,
    characterId,
    collectionId,
    conceptId,
    creationId,
    generatorId,
    outputType,
    isPrivate,
    name,
    maxDate,
    minDate,
    limit,
    page,
    orderBy,
    direction,
  } = request.query as FeedCreationsArguments

  const creatorsRepository = new CreatorRepository(User)
  const creators = filterUserIds
    ? await creatorsRepository.query({
        _id: filterUserIds,
      })
    : { docs: [] }
  const ownUserId = request.user ? request.user.userId : undefined
  const creatorId =
    filterUserIds && creators.docs && creators.docs.length
      ? creators.docs.map(creator => creator._id)[0].toString()
      : undefined
  const isUserRequestingOwnProfileFeed =
    creatorId && ownUserId && ownUserId.toString() === creatorId

  const characterIds = characterId
    ? Array.isArray(characterId)
      ? characterId.map(id => new ObjectId(id))
      : new ObjectId(characterId)
    : undefined

  const conceptIds = conceptId
    ? Array.isArray(conceptId)
      ? conceptId.map(id => new ObjectId(id))
      : new ObjectId(conceptId)
    : undefined

  const generatorIds = generatorId
    ? Array.isArray(generatorId)
      ? generatorId.map(id => new ObjectId(id))
      : new ObjectId(generatorId)
    : undefined

  const outputTypes = outputType
    ? Array.isArray(outputType)
      ? outputType.map(type => String(type))
      : [String(outputType)]
    : undefined

  const filters: Filters = {
    ...(typeof outputTypes !== 'undefined'
      ? { 'mediaAttributes.type': { $in: outputTypes } }
      : {}),
    ...(typeof isPrivate !== 'undefined'
      ? { isPrivate: isPrivate === 'true' }
      : {}),
  }
  const creationRepository = new CreationRepository(Creation)
  let creations: PaginatedResponse<CreationDocument>

  if (orderBy === 'following' && ownUserId) {
    const followCreationRepository = new CreationRepository(Follow) //@todo: this reads rather wonky
    const followAggregate = aggregateCreationsByFollowerId(
      new ObjectId(ownUserId),
      maxDate || new Date().toISOString(),
      filters,
    )

    creations = await followCreationRepository.aggregateQuery(followAggregate, {
      limit,
      page,
      sort: { createdAt: -1 },
    })
  } else if (orderBy === 'liked' && ownUserId) {
    const reactionCreationRepository = new CreationRepository(Reaction) //@todo: this reads rather wonky
    const userReactionAggregate = aggregateCreationsByUserLikes(
      new ObjectId(ownUserId),
      maxDate || new Date().toISOString(),
      filters,
    )

    creations = await reactionCreationRepository.aggregateQuery(
      userReactionAggregate,
      {
        limit,
        page,
        sort: { createdAt: -1 },
      },
    )
  } else if (orderBy === 'embedding.score') {
    // if (minDate) {
    //   createdAtFilter['$gte'] = new Date(minDate)
    // }
    // if (maxDate) {
    //   createdAtFilter['$lte'] = new Date(maxDate)
    // }

    const creationsAggregate = aggregateCreationsByEmbeddingScore(
      maxDate || new Date().toISOString(),
      minDate ? minDate : undefined,
      filters,
    )
    creations = await creationRepository.aggregateQuery(creationsAggregate, {
      limit,
      page,
      sort: {
        'embedding.score_adjusted': -1,
        _id: -1,
      },
    })
  } else {
    const collection = collectionId
      ? await Collection.findById(collectionId)
      : undefined
    const collectionCreations =
      collection && collection?.creations ? collection.creations : undefined

    const sort = []
    const sortFilter: { [key: string]: unknown } = {}

    if (orderBy === 'popularity') {
      sort.push(['praiseCount', direction])
      sort.push(['bookmarkCount', direction])
      sortFilter['$or'] = [
        { bookmarkCount: { $gt: 0 } },
        { praiseCount: { $gt: 0 } },
      ]
    } else {
      if (orderBy && direction) {
        sort.push([orderBy, direction])
      }

      // exclude zero count items when sorting by likes, bookmarks, etc
      if (orderBy === 'bookmarkCount' || orderBy === 'praiseCount') {
        sortFilter[orderBy] = { $gt: 0 }
      }
    }

    // add secondary sort condition "by newest" to all other sort fields to avoid random indexes for equal sort positions
    if (orderBy !== 'createdAt') {
      sort.push(['createdAt', -1])
    }

    if (
      !isUserRequestingOwnProfileFeed &&
      !(
        collection &&
        collection.user &&
        ownUserId &&
        collection.user.toString() === ownUserId.toString()
      )
    ) {
      sortFilter['isPrivate'] = { $eq: false }
    }

    // needed to not end up with duplicates in aggregations wtf mongo
    sort.push(['_id', -1])

    let creationIdsQuery = collectionCreations
      ? {
          $in: collectionCreations.map(
            collectionCreation => collectionCreation._id,
          ),
        }
      : undefined

    // querying for similar creations
    if (creationId) {
      const embeddingDoc = (await Embedding.findOne({
        creation: new ObjectId(creationId),
      }).lean()) as EmbeddingDocument
      try {
        if (embeddingDoc?.embedding?.length) {
          const similarCreationIds = await getSimilarCreationIds(
            server,
            embeddingDoc.embedding,
          )
          creationIdsQuery = similarCreationIds
            ? {
                $in: similarCreationIds,
              }
            : undefined
        } else {
          return reply.status(200).send(emptyPaginatedResponse)
        }
      } catch (e) {
        console.log('Error fetching chroma embeddings', e)
        return reply.status(200).send(emptyPaginatedResponse)
      }
    }

    const createdAtFilter: { $gte?: Date; $lte?: Date } = {}
    if (minDate) {
      createdAtFilter['$gte'] = new Date(minDate)
    }
    if (maxDate) {
      createdAtFilter['$lte'] = new Date(maxDate)
    }

    const query = {
      _id: creationIdsQuery,
      concept: conceptIds ? { $in: conceptIds } : undefined,
      generator: generatorIds ? { $in: generatorIds } : undefined,
      createdAt: Object.keys(createdAtFilter).length
        ? createdAtFilter
        : undefined,
      user:
        filterUserIds && creators.docs
          ? creators.docs.map(creator => creator._id)
          : undefined,
      ...sortFilter,
      ...(name ? { $text: { $search: name } } : {}),
      character: filterUserIds
        ? { $exists: false }
        : characterIds
        ? { $in: characterIds }
        : undefined,
      ...filters,
    }

    creations = await creationRepository.query(query, {
      limit,
      page,
      sort,
    })
  }

  await creationRepository.model.populate(creations.docs, {
    path: 'user',
    select: 'userId username userImage',
  })
  await creationRepository.model.populate(creations.docs, {
    path: 'task',
    select: 'config status generator',
    populate: { path: 'generator', select: 'generatorName description output' },
  })

  if (ownUserId) {
    interface CreationDocumentExtension {
      reactions: Map<ReactionType, boolean>
      bookmarked: boolean
    }

    type FeedResponse = {
      docs: CreationDocumentExtension[]
      reactions: { [key: string]: Map<ReactionType, boolean> } | []
      bookmarks: { [key: string]: boolean } | []
    }

    const feed: FeedResponse = {
      ...creations,
      docs: [],
      reactions: [],
      bookmarks: [],
    }

    if (creations.docs) {
      const uid = new ObjectId(ownUserId)
      const reactionsMap = await getCreationReactions(uid, creations.docs)
      const bookmarksMap = await getCreationBookmarks(uid, creations.docs)

      const extendedDocs = creations.docs.map(creation => {
        return {
          ...(typeof creation.toObject !== 'undefined'
            ? creation.toObject()
            : creation), //aggregate returns different format than query
          reactions: reactionsMap[creation._id.toString()],
          bookmarked: bookmarksMap[creation._id.toString()],
        }
      })
      feed.docs = extendedDocs
      feed.reactions = reactionsMap
      feed.bookmarks = bookmarksMap
    }
    return reply.status(200).send(feed)
  } else {
    // No user, so no reactions or bookmarks
    return reply.status(200).send(creations)
  }
}

const conceptsAggregate = (
  searchText: string,
  userId: string,
  filter?: {
    isPrivate?: { $eq?: boolean }
    deleted?: { $eq?: boolean }
  },
) => {
  const pipelines: PipelineStage[] = [
    {
      $search: {
        compound: {
          should: [
            {
              autocomplete: {
                query: searchText,
                path: 'name',
              },
            },
            {
              autocomplete: {
                query: searchText,
                path: 'conceptName',
              },
            },
            {
              text: {
                query: searchText,
                path: 'name',
                fuzzy: {
                  maxEdits: 2,
                },
              },
            },
            {
              text: {
                query: searchText,
                path: 'conceptName',
                fuzzy: {
                  maxEdits: 2,
                },
              },
            },
          ],
          minimumShouldMatch: 1,
        },
      },
    },
  ]

  if (userId) {
    pipelines.push({
      $match: {
        user: new ObjectId(userId),
      },
    })
  }

  if (filter?.isPrivate) {
    pipelines.push({
      $match: {
        isPrivate: filter.isPrivate,
      },
    })
  }

  if (filter?.deleted) {
    pipelines.push({
      $match: {
        deleted: filter.deleted,
      },
    })
  }

  return Concept.aggregate(pipelines)
}

export const getConceptsFeed = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const {
    userId: filterUserIds,
    name,
    limit,
    page,
    orderBy,
    direction,
  } = request.query as FeedConceptsArguments
  const creatorsRepository = new CreatorRepository(User)
  const creators = await creatorsRepository.query({
    _id: filterUserIds,
  })
  const ownUserId = request.user ? request.user.userId : undefined
  const creatorId =
    filterUserIds && creators.docs && creators.docs.length
      ? creators.docs.map(creator => creator._id)[0].toString()
      : undefined
  const isUserRequestingOwnProfileFeed =
    creatorId && ownUserId && ownUserId.toString() === creatorId
  // console.log({ filterUserIds, creators, ownUserId, creatorId })

  const conceptRepository = new ConceptRepository(Concept)

  const sort = []
  const sortFilter: { [key: string]: unknown } = {}

  // exclude zero count items when sorting by likes, bookmarks, etc
  if (
    orderBy === 'creationCount' ||
    orderBy === 'bookmarkCount' ||
    orderBy === 'praiseCount'
  ) {
    sortFilter[orderBy] = { $gt: 0 }
  }

  if (orderBy && direction) {
    sort.push([orderBy, direction])
  }

  // add secondary sort condition "by newest" to all other sort fields to avoid random indexes for equal sort positions
  if (orderBy !== 'createdAt') {
    sort.push(['createdAt', -1])
  }

  if (!isUserRequestingOwnProfileFeed) {
    sortFilter['isPrivate'] = { $eq: false }
  }

  // needed to not end up with duplicates in aggregations wtf mongo
  sort.push(['_id', -1])

  let concepts: PaginatedResponse<ConceptDocument>
  // use atlas search query
  if (name) {
    const aggregate = conceptsAggregate(name, creatorId, {
      ...sortFilter,
      deleted: { $eq: false },
    })
    // console.log(JSON.stringify(aggregate))
    const sortObj = Object.fromEntries(sort)
    // console.log(sortObj)
    concepts = await conceptRepository.aggregateQuery(aggregate, {
      limit,
      page,
      sort: sortObj,
    })
    // console.log(concepts)
    // use flat query
  } else {
    concepts = await conceptRepository.query(
      {
        user:
          filterUserIds && creators.docs
            ? creators.docs.map(creator => creator._id)
            : undefined,
        ...sortFilter,
      },
      {
        limit,
        page,
        sort,
      },
    )
  }

  await conceptRepository.model.populate(concepts.docs, {
    path: 'user',
    select: 'userId username userImage',
  })
  await conceptRepository.model.populate(concepts.docs, {
    path: 'task',
    select: 'status config generator',
    populate: { path: 'generator', select: 'generatorName output' },
  })

  // @ts-ignore
  concepts.docs = concepts.docs.map(concept => {
    // @ts-ignore
    const conceptWithoutTrainingImages =
      concept instanceof mongoose.Document ? concept.toObject() : concept

    if (typeof conceptWithoutTrainingImages.training_images !== 'undefined') {
      delete conceptWithoutTrainingImages.training_images
    }

    if (
      typeof conceptWithoutTrainingImages.task !== 'undefined' &&
      typeof conceptWithoutTrainingImages.task.config !== 'undefined' &&
      typeof conceptWithoutTrainingImages.task.config.lora_training_urls !==
        'undefined'
    ) {
      delete conceptWithoutTrainingImages.task.config.lora_training_urls
    }

    return conceptWithoutTrainingImages
  })

  return reply.status(200).send(concepts)
}

const charactersAggregate = (
  searchText: string,
  userId: string,
  filter?: {
    isPrivate?: { $eq?: boolean }
    deleted?: { $eq?: boolean }
  },
) => {
  const pipelines: PipelineStage[] = [
    {
      $search: {
        compound: {
          should: [
            {
              autocomplete: {
                query: searchText,
                path: 'name',
              },
            },
            {
              text: {
                query: searchText,
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
    },
  ]

  if (userId) {
    pipelines.push({
      $match: {
        user: new ObjectId(userId),
      },
    })
  }

  if (filter?.isPrivate) {
    pipelines.push({
      $match: {
        isPrivate: filter.isPrivate,
      },
    })
  }

  if (filter?.deleted) {
    pipelines.push({
      $match: {
        deleted: filter.deleted,
      },
    })
  }

  return Character.aggregate(pipelines)
}

export const getCharactersFeed = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const {
    userId: filterUserIds,
    name,
    limit,
    page,
    orderBy,
    direction,
  } = request.query as FeedCharactersArguments

  const creatorsRepository = new CreatorRepository(User)
  const creators = await creatorsRepository.query({
    _id: filterUserIds,
  })

  const ownUserId = request.user ? request.user.userId : undefined
  const creatorId =
    filterUserIds && creators.docs && creators.docs.length
      ? creators.docs.map(creator => creator._id)[0].toString()
      : undefined
  const isUserRequestingOwnProfileFeed =
    creatorId && ownUserId && ownUserId.toString() === creatorId

  const characterRepo = new CharacterRepository(Character)

  const sort = []
  const sortFilter: { [key: string]: unknown } = {}

  // exclude zero count items when sorting by likes, bookmarks, etc
  if (
    orderBy === 'creationCount' ||
    orderBy === 'bookmarkCount' ||
    orderBy === 'praiseCount'
  ) {
    sortFilter[orderBy] = { $gt: 0 }
  }

  if (orderBy && direction) {
    sort.push([orderBy, direction])
  }

  // add secondary sort condition "by newest" to all other sort fields to avoid random indexes for equal sort positions
  if (orderBy !== 'createdAt') {
    sort.push(['createdAt', -1])
  }

  if (!isUserRequestingOwnProfileFeed) {
    sortFilter['isPrivate'] = { $eq: false }
  }

  // needed to not end up with duplicates in aggregations wtf mongo
  sort.push(['_id', -1])

  let characters: PaginatedResponse<CharacterDocument>
  // use atlas search query
  if (name) {
    const aggregate = charactersAggregate(name, creatorId, {
      ...sortFilter,
      deleted: { $eq: false },
    })
    const sortObj = Object.fromEntries(sort)
    characters = await characterRepo.aggregateQuery(aggregate, {
      limit,
      page,
      sort: sortObj,
    })
    // use flat query
  } else {
    characters = await characterRepo.query(
      {
        user:
          filterUserIds && creators.docs
            ? creators.docs.map(creator => creator._id)
            : undefined,
        ...sortFilter,
      },
      {
        limit,
        page,
        sort,
      },
    )
  }

  await characterRepo.model.populate(characters.docs, {
    path: 'user',
    select: 'userId username userImage',
  })

  return reply.status(200).send(characters)
}

const creatorsAggregate = (searchText: string) => {
  const pipelines: PipelineStage[] = [
    {
      $search: {
        compound: {
          should: [
            {
              autocomplete: {
                query: searchText,
                path: 'username',
              },
            },
            {
              text: {
                query: searchText,
                path: 'username',
                fuzzy: {
                  maxEdits: 2,
                },
              },
            },
          ],
          minimumShouldMatch: 1,
        },
      },
    },
  ]

  pipelines.push({
    $match: {
      deleted: { $eq: false },
    },
  })

  return User.aggregate(pipelines)
}

export const getCreatorsFeed = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { name, limit, page, orderBy, direction } =
    request.query as FeedCreatorsArguments
  const creatorsRepository = new CreatorRepository(User)

  const sort = []
  const sortFilter: { [key: string]: unknown } = {}

  // exclude zero count items when sorting by likes, bookmarks, etc
  if (orderBy === 'followerCount') {
    sortFilter[orderBy] = { $gt: 0 }
  }

  if (orderBy && direction) {
    sort.push([orderBy, direction])
  }

  // add secondary sort condition "by newest" to all other sort fields to avoid random indexes for equal sort positions
  if (orderBy !== 'createdAt') {
    sort.push(['createdAt', -1])
  }

  // needed to not end up with duplicates in aggregations wtf mongo
  sort.push(['_id', -1])

  let creators: PaginatedResponse<UserDocument>
  // use atlas search query
  if (name) {
    const aggregate = creatorsAggregate(name)
    // console.log(JSON.stringify(aggregate))
    const sortObj = Object.fromEntries(sort)
    // console.log(sortObj)
    creators = await creatorsRepository.aggregateQuery(aggregate, {
      limit,
      page,
      sort: sortObj,
    })
  } else {
    creators = await creatorsRepository.query(
      {},
      {
        limit,
        page,
        sort,
      },
    )
  }

  return reply.status(200).send(creators)
}
