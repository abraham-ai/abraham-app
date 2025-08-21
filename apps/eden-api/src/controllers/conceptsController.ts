import { Concept, ConceptDocument } from '../models/Concept'
import { Reaction } from '../models/Reaction'
import { User } from '../models/User'
import ConceptRepository from '../repositories/ConceptRepository'
import CreatorRepository from '../repositories/CreatorRepository'
import {
  AdminConceptsExportToHFArguments,
  ConceptsDeleteArguments,
  ConceptsGetArguments,
  ConceptsListArguments,
  ConceptsReactArguments,
  ConceptsUnreactArguments,
  ConceptsUpdateArguments,
  ReactionType,
} from '@edenlabs/eden-sdk'
import { createRepo, deleteRepo, uploadFile } from '@huggingface/hub'
import axios from 'axios'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { promises as fs } from 'fs'
import { readdir } from 'fs/promises'
import { ObjectId } from 'mongodb'
import { join } from 'path'
import tar from 'tar'

const downloadAndUntar = async (conceptUri: string, outputDir: string) => {
  const response = await axios.get(conceptUri, { responseType: 'stream' })
  response.data.pipe(tar.x({ C: outputDir }))
  return new Promise((resolve, reject) => {
    response.data.on('end', resolve)
    response.data.on('error', reject)
  })
}

const uploadDirToHuggingFace = async (
  dirPath: string,
  repo: string,
  hfToken: string,
): Promise<void> => {
  const files: string[] = await readdir(dirPath)
  for (const file of files) {
    const filePath = join(dirPath, file)
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const content = new Blob([fileContent])
    const params = {
      repo,
      credentials: { accessToken: hfToken },
      file: {
        path: file,
        content: content,
      },
    }
    await uploadFile(params)
  }
}

export const getReactions = async (
  userId: ObjectId,
  concepts: ConceptDocument[],
): Promise<{ [key: string]: Map<ReactionType, boolean> }> => {
  const reactions = await Reaction.aggregate([
    {
      $match: {
        user: userId,
        concept: {
          $in: concepts.map(concept => concept._id),
        },
      },
    },
    {
      $lookup: {
        from: 'concepts',
        localField: 'concept',
        foreignField: '_id',
        as: 'concept',
      },
    },
    {
      $unwind: '$concept',
    },
  ])

  // Convert reactions to a map for easy lookup
  const reactionsMap = reactions.reduce((map, reaction) => {
    const conceptId = reaction.concept._id.toString()
    if (!map[conceptId]) {
      map[conceptId] = {}
    }
    map[conceptId][reaction.reaction] = true
    return map
  }, {} as { [key: string]: ReactionType[] }) // explicitly set the type of the accumulator

  return reactionsMap
}

// export const getBookmarks = async (
//   userId: ObjectId,
//   concepts: ConceptDocument[],
// ): Promise<{ [key: string]: boolean }> => {
//   return {}
// }

export const listConcepts = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId, limit, page, sort, name } =
    request.query as ConceptsListArguments
  const creatorsRepository = new CreatorRepository(User)
  const creators = await creatorsRepository.query({
    userId,
  })

  const conceptRepository = new ConceptRepository(Concept)
  const concepts = await conceptRepository.query(
    {
      user:
        userId && creators.docs
          ? creators.docs.map(creator => creator._id)
          : undefined,
      ...(name ? { $text: { $search: name } } : {}),
    },
    {
      limit,
      page,
      sort,
    },
  )

  type ConceptType = {
    publicName?: string
    training_images?: string[]
    uri?: string
  }
  let conceptsWithPublicName: ConceptType[] = await Promise.all(
    concepts.docs.map(async doc => {
      const user = await User.findById(doc.user._id)
      const publicName = `${user?.username}:${doc.name}`
      return {
        ...doc.toObject(),
        publicName,
      }
    }),
  )

  conceptsWithPublicName = conceptsWithPublicName.map(concept => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { training_images, ...rest } = concept
    return rest
  })

  const response = {
    ...concepts,
    docs: conceptsWithPublicName,
  }

  return reply.status(200).send(response)
}

export const getConcept = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { conceptId } = request.params as ConceptsGetArguments

  const concept = (await Concept.findById(conceptId, {})
    .populate({
      path: 'user',
      select: 'userId username userImage',
    })
    .populate({
      path: 'task',
      select: 'status config',
      populate: { path: 'generator', select: 'generatorName output' },
    })) as ConceptDocument & {
    reactions?: Map<ReactionType, boolean>
    bookmarked?: boolean
  }

  if (!concept) {
    return reply.status(404).send({
      message: 'Concept not found',
    })
  }

  if (concept.isPrivate) {
    if (concept.user._id.toString() !== request.user?.userId.toString()) {
      console.error('User not authorized to view this')
      return reply.status(401).send({
        message: 'User not authorized to view this',
      })
    }
  }

  const conceptObject = concept.toObject()
  delete conceptObject.training_images
  if (
    conceptObject.task !== undefined &&
    conceptObject.task.config !== undefined
  ) {
    delete conceptObject.task.config.lora_training_urls
  }

  return reply.status(200).send({ concept: conceptObject })
}

export const conceptDelete = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { conceptId } = request.params as ConceptsDeleteArguments

  const concept = await Concept.findById(conceptId)

  if (!concept) {
    return reply.status(404).send({
      message: 'Concept not found',
    })
  }

  if (concept.user.toString() !== userId.toString()) {
    return reply.status(401).send({
      message: 'User not authorized to delete this',
    })
  }

  await concept.delete()

  return reply.status(200).send({
    success: true,
  })
}

export const conceptUpdate = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { conceptId } = request.params as ConceptsUpdateArguments
  const { isPrivate, description } = request.body as ConceptsUpdateArguments

  if (
    !userId ||
    !conceptId ||
    (typeof description === 'undefined' && typeof isPrivate === 'undefined')
  ) {
    return reply.status(422).send({
      message: 'Missing parameters or malformed request body',
    })
  }

  const concept = await Concept.findOne({
    _id: conceptId,
    user: userId,
  })

  if (!concept) {
    return reply.status(404).send({
      message: 'Concept not found',
    })
  }

  if (typeof description !== 'undefined') {
    concept.description = description
  }

  if (typeof isPrivate !== 'undefined') {
    concept.isPrivate = isPrivate
  }

  await concept.save()

  return reply.status(200).send({
    concept,
  })
}

export const conceptReact = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { conceptId, reaction } = request.body as ConceptsReactArguments

  // check if reaction in ReactionType enum
  if (!Object.values(ReactionType).includes(reaction)) {
    return reply.status(400).send({
      message: 'Invalid reaction',
    })
  }

  const concept = await Concept.findById(conceptId)

  if (!concept) {
    return reply.status(404).send({
      message: 'Concept not found',
    })
  }

  const reactionData = {
    concept: conceptId,
    user: userId,
    reaction,
  }

  const existingReaction = await Reaction.findOne(reactionData)

  if (existingReaction) {
    return reply.status(400).send({
      message: 'Reaction already exists',
    })
  }

  await Reaction.create(reactionData)

  await concept.updateOne({
    $inc: {
      praiseCount: reaction === ReactionType.Praise ? 1 : 0,
    },
  })

  return reply.status(200).send({
    success: true,
  })
}

export const conceptUnreact = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user
  const { conceptId, reaction } = request.body as ConceptsUnreactArguments

  // check if reaction in ReactionType enum
  if (!Object.values(ReactionType).includes(reaction)) {
    return reply.status(400).send({
      message: 'Invalid reaction',
    })
  }

  const concept = await Concept.findById(conceptId)

  if (!concept) {
    return reply.status(404).send({
      message: 'Concept not found',
    })
  }

  const reactionData = {
    concept: conceptId,
    user: userId,
    reaction,
  }

  const existingReaction = await Reaction.findOne(reactionData)

  if (!existingReaction) {
    return reply.status(400).send({
      message: 'Reaction does not exist',
    })
  }

  await existingReaction.deleteOne()

  await concept.updateOne({
    $inc: {
      praiseCount: reaction === ReactionType.Praise ? -1 : 0,
    },
  })

  return reply.status(200).send({
    success: true,
  })
}

export const conceptExportToHF = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId, conceptId } = request.body as AdminConceptsExportToHFArguments
  const frontendUrl = server.config.FRONTEND_URL

  const user = await User.findOne({ userId })
  if (!user) {
    return reply.status(404).send({
      message: 'User not found',
    })
  }

  if (!server.config.HF_TOKEN) {
    return reply.status(500).send({
      message: 'Missing HF_TOKEN in server config',
    })
  }

  const concept = await Concept.findById(conceptId)

  if (!concept) {
    return reply.status(404).send({
      message: 'Concept not found',
    })
  }

  if (concept.user.toString() !== user.id.toString()) {
    return reply.status(401).send({
      message: 'You may only export your own concepts',
    })
  }

  const repo = `eden-art/${concept.name}`
  let repoUrl
  try {
    const repoResult = await createRepo({
      repo,
      credentials: {
        accessToken: server.config.HF_TOKEN as string,
      },
    })
    repoUrl = repoResult.repoUrl
  } catch (e) {
    return reply.status(400).send({
      message: 'Concept already exists on HuggingFace',
    })
  }

  const { uri } = concept
  const dirPath = `/tmp/${concept.name}`
  await fs.mkdir(dirPath, { recursive: true })
  await downloadAndUntar(uri, dirPath)

  // Create dynamic README.md / HF model card
  const username = user.username
  const conceptName = concept.name
  const conceptUri = concept.uri
  const conceptThumbnail = concept.thumbnail
  const num_training_images = concept.num_training_images || 0
  const readmeContent = `---
language: 
  - en
thumbnail: "${conceptThumbnail}"
base_model: "stabilityai/stable-diffusion-xl-base-1.0"
---

## [${conceptName}](${conceptUri})

LoRA trained on [Eden.art](https://eden.art) by [${username}](${frontendUrl}/creators/${username}) on ${num_training_images} images.

* [How to train Concepts (LoRAs) on Eden](https://docs.eden.art/docs/guides/concepts)
* [How to export LoRAs from Eden](https://docs.eden.art/docs/guides/concepts#exporting-loras-for-use-in-other-tools)

![Samples](${conceptThumbnail})`

  const readmePath = join(dirPath, 'README.md')
  await fs.writeFile(readmePath, readmeContent)

  await uploadDirToHuggingFace(dirPath, repo, server.config.HF_TOKEN)
  await fs.rmdir(dirPath, { recursive: true })

  await concept.updateOne({
    $set: {
      publishedUrl: repoUrl,
    },
  })

  return reply.status(200).send({
    url: repoUrl,
  })
}

export const removeConceptFromHF = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId, conceptId } = request.body as AdminConceptsExportToHFArguments

  const user = await User.findOne({ userId })
  if (!user) {
    return reply.status(404).send({
      message: 'User not found',
    })
  }

  if (!server.config.HF_TOKEN) {
    return reply.status(500).send({
      message: 'Missing HF_TOKEN in server config',
    })
  }

  const concept = await Concept.findById(conceptId)

  if (!concept) {
    return reply.status(404).send({
      message: 'Concept not found',
    })
  }

  if (concept.user.toString() !== user.id.toString()) {
    return reply.status(401).send({
      message: 'You may only export your own concepts',
    })
  }

  const { publishedUrl } = concept
  if (!publishedUrl) {
    return reply.status(400).send({
      message: 'Concept is not published on HuggingFace',
    })
  }

  const parts = publishedUrl.split('/')
  const repo = parts.slice(-2).join('/')
  const repoUrl = `https://huggingface.co/${repo}`
  await deleteRepo({
    repo,
    credentials: {
      accessToken: server.config.HF_TOKEN as string,
    },
  })

  await concept.updateOne({
    $unset: {
      publishedUrl: '',
    },
  })

  return reply.status(200).send({
    url: repoUrl,
  })
}
