import archiver from 'archiver'
import axios from 'axios'
import { FastifyInstance, FastifyReply } from 'fastify'
import { Readable } from 'stream'

export const downloadZip = async (
  files: { url: string; fileName: string; fileExtension: string }[],
  reply: FastifyReply,
  server: FastifyInstance,
) => {
  // **1. Initialize the ZIP Archive**
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Maximum compression
  })

  // **2. Handle Archive Events**
  archive.on('error', err => {
    console.error('Archiver error:', err)
    if (!reply.sent) {
      reply.status(500).send({ message: 'Error creating ZIP archive.' })
    }
  })

  // **3. Set Response Headers**
  reply.header('Content-Type', 'application/zip')
  reply.header('Content-Disposition', `attachment; filename="downloads.zip"`)

  // **4. Stream the Archive to the Client**
  reply.send(archive)

  // **5. Append Files to the Archive**
  for (const file of files) {
    const { url, fileName, fileExtension } = file

    // **a. Determine the Desired File Name**
    const desiredFileName = fileName
      ? fileExtension
        ? `${fileName}.${fileExtension}`
        : fileName
      : url.split('/').pop() || 'file'

    try {
      // **b. Generate Signed URLs as Before**
      const isCloudinaryAsset = url.startsWith('https://res.cloudinary.com')
      let signedUrl: string

      if (isCloudinaryAsset) {
        signedUrl = await server.getCldSignedDownloadUrl(url, desiredFileName)
      } else {
        signedUrl = await server.getS3SignedDownloadUrl(
          server,
          url,
          desiredFileName,
        )
      }

      if (!signedUrl) {
        console.error(`No signed URL generated for file: ${desiredFileName}`)
        continue // Skip this file
      }

      // **c. Fetch the File as a Stream**
      const response = await axios.get<Readable>(signedUrl, {
        responseType: 'stream',
      })

      // **d. Append the File Stream to the Archive**
      archive.append(response.data, { name: desiredFileName })
    } catch (error: any) {
      console.error(`Error processing file "${desiredFileName}":`, error)
      // Optionally, you can choose to skip failed files or abort the entire archive
      // Here, we'll skip the failed file
      continue
    }
  }

  // **6. Finalize the Archive**
  archive.finalize()

  // **7. Do Not Return Any Value**
  // Fastify handles the response via the stream
}
