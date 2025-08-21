import { calculateMaxDimensions } from '../lib/eden2'
import axios from 'axios'
import { encode } from 'blurhash'
import { FastifyInstance } from 'fastify'
import sharp from 'sharp'

export const generateBlurhash = async (
  server: FastifyInstance,
  imageUrl: string,
  width?: number,
  height?: number,
) => {
  try {
    const IMAGE_SIZE = 384
    server.log.info(`Fetching thumbnail from URL: ${imageUrl}`)

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 5000, // Timeout after 5 seconds
    })
    const buffer = Buffer.from(response.data)

    const aspectRatio = (width || IMAGE_SIZE) / (height || IMAGE_SIZE)
    const { width: resizedWidth, height: resizedHeight } =
      calculateMaxDimensions(aspectRatio, IMAGE_SIZE)

    const image = await sharp(buffer)
      .resize(resizedWidth, resizedHeight)
      .raw()
      .ensureAlpha()
      .toBuffer()

    const blurhash = encode(
      new Uint8ClampedArray(image.buffer),
      resizedWidth,
      resizedHeight,
      4,
      4,
    )

    server.log.info(`BlurHash generated successfully for result: ${imageUrl}`)

    return blurhash
  } catch (e) {
    server.log.error(`Error creating blurhash for result: ${imageUrl}`, e)
    return ''
  }
}
