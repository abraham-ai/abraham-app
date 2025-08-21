import { FastifyInstance } from 'fastify'
import { v4 as uuidv4 } from 'uuid'

import { Character } from '../../models/Character'

export const submitMonologueTask = async (
  server: FastifyInstance,
  config: any,
) => {
  if (!server.airflow) {
    throw new Error('Airflow not registered')
  }

  const character = await Character.findById(config.characterId)
  if (!character) {
    throw new Error('Character not found')
  }

  const taskId = uuidv4()
  await server.airflow.submitTask({
    dagId: 'handler_monologue',
    taskId,
    config: {
      prompt: config.prompt,
      character_name: character.name,
      character_description: character.logosData?.identity,
      face_url: character.image,
    },
  })
  return taskId
}
