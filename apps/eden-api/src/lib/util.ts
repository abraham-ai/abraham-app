import axios from 'axios'
import crypto from 'crypto'
import { FastifyInstance } from 'fastify'
import { writeFile } from 'fs/promises'

export const sha256 = (data: crypto.BinaryLike) => {
  const hashSum = crypto.createHash('sha256')
  hashSum.update(data)
  return hashSum.digest('hex')
}

export const randomId = (length: number) => {
  const rand = crypto.randomBytes(length)
  const uniqueId = rand.toString('hex')
  return uniqueId
}

export const getAdminHeaders = (server: FastifyInstance) => {
  return {
    'X-Api-Key': server.config.EDEN_ADMIN_API_KEY,
    'X-Api-Secret': server.config.EDEN_ADMIN_API_SECRET,
  }
}

export async function downloadBuffer(url: string): Promise<Buffer> {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
    })
    return Buffer.from(response.data, 'binary')
  } catch (error) {
    console.error(`Error in downloadFile: ${error}`)
    throw error
  }
}

export async function downloadFile(url: string, path: string) {
  try {
    const buffer = await downloadBuffer(url)
    await writeFile(path, buffer)
  } catch (error) {
    console.error(`Error in downloadFile: ${error}`)
    throw error
  }
}
