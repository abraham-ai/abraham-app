import { Generator, GeneratorVersionSchema } from '../models/Generator'
import GeneratorRepository from '../repositories/GeneratorRepository'
import {
  GeneratorsGetArguments,
  GeneratorsListArguments,
} from '@edenlabs/eden-sdk'
import { FastifyReply, FastifyRequest } from 'fastify'

export const getGenerator = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { generatorName } = request.params as GeneratorsGetArguments
  const generator = await Generator.findOne({ generatorName })

  if (!generator) {
    return reply.status(404).send({
      message: 'Generator not found',
    })
  }

  const generatorObj = {
    generatorName: generator.generatorName,
    output: generator.output,
    description: generator.description,
    defaultVersionId: generator.defaultVersionId,
    deployment: generator.deployment,
    versions: generator.versions.filter(
      (version: GeneratorVersionSchema) =>
        version.versionId === generator.defaultVersionId,
    ),
    visible: generator.visible,
  }

  return reply.status(200).send({ generator: generatorObj })
}

export const listGenerators = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { limit, page, sort, visible } =
    request.query as GeneratorsListArguments
  const generatorRepository = new GeneratorRepository(Generator)
  const generators = await generatorRepository.query(
    {
      visible,
    },
    {
      limit,
      page,
      sort,
    },
  )

  const response = {
    ...generators,
    docs: generators.docs.map(generator => ({
      _id: generator._id,
      generatorName: generator.generatorName,
      output: generator.output,
      description: generator.description,
      defaultVersionId: generator.defaultVersionId,
      deployment: generator.deployment,
      versions: generator.versions.filter(
        (version: GeneratorVersionSchema) =>
          version.versionId === generator.defaultVersionId,
      ),
      visible: generator.visible,
    })),
  }

  return reply.status(200).send(response)
}
