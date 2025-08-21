import axios from 'axios'
import type { FastifyInstance } from 'fastify'

export class PlayHT {
  headers: {
    'Content-Type': string
    Authorization: string
    'X-User-ID': string
  }

  url: string

  constructor(url: string, apiKey: string, apiSecret: string) {
    this.url = url
    this.headers = {
      'Content-Type': 'application/json',
      Authorization: apiSecret,
      'X-User-ID': apiKey,
    }
  }

  startTask = async (voice: string, text: string) => {
    const body = {
      voice,
      content: [text],
    }
    const response = await axios.post(this.url, body, { headers: this.headers })
    if (response.status !== 201) {
      throw new Error('Failed')
    }
    const jobId = response.data.transcriptionId
    console.log(`Submitted job ${jobId} to PlayHT`)
    return jobId
  }

  pollForTask = async (pollingInterval: number, jobId: string) => {
    const urlFetch = `https://play.ht/api/v1/articleStatus?transcriptionId=${jobId}`
    let finished = false
    while (!finished) {
      const response = await axios.get(urlFetch, { headers: this.headers })
      console.log('response2', response.data)
      if (response.status !== 200) {
        throw new Error('Failed')
      }
      const { data } = response
      if (data.transcriped) {
        finished = true
        const audioUrl = data.audioUrl[0]
        console.log(`Got audio url ${audioUrl}`)
        return audioUrl
      }
      await new Promise(resolve => setTimeout(resolve, pollingInterval))
    }
  }
}

export const registerPlayHt = async (fastify: FastifyInstance) => {
  try {
    const playHt = new PlayHT(
      'https://play.ht/api/v1/convert',
      process.env.PLAYHT_API_KEY!,
      process.env.PLAYHT_API_SECRET!,
    )
    fastify.decorate('playHt', playHt)
    fastify.log.info('Successfully registered plugin: PlayHt')
  } catch (err) {
    fastify.log.error('Plugin: PlayHt, error on register', err)
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    playHt?: PlayHT
  }
}

export default registerPlayHt
