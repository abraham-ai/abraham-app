import { User, UserDocument } from '../../models/User'
import { sendWelcomeEmail } from '../../utils/mailchimp'
import { createNewUser } from './authController'
import { WebhookEvent } from '@clerk/clerk-sdk-node'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { IncomingHttpHeaders } from 'http'
import { Webhook, WebhookRequiredHeaders } from 'svix'

function replaceDotsInEmailAddress(email: string) {
  return email.split('@')[0].replace(/\./g, '')
}

function normalizeGmailAddress(email: string) {
  if (email) {
    if (email.includes('@gmail.com')) {
      return replaceDotsInEmailAddress(email) + '@gmail.com'
    }
    if (email.includes('@googlemail.com')) {
      return replaceDotsInEmailAddress(email) + '@googlemail.com'
    }
  }
  return email
}

const BLACKLIST = [
  {
    words: ['uffa'],
    domain: 'hotmail.com',
  },
  {
    words: ['uffan'],
  },
]

export const receiveUserUpdate = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (!server.config.CLERK_WEBHOOK_SECRET) {
    return reply.status(400).send('Webhook Error: Missing webhook secret')
  }
  const wh = new Webhook(server.config.CLERK_WEBHOOK_SECRET)
  const payload = JSON.stringify(request.body)
  const headers = request.headers as IncomingHttpHeaders &
    WebhookRequiredHeaders

  let evt: WebhookEvent
  try {
    evt = wh.verify(payload, headers) as WebhookEvent
  } catch (err) {
    return reply.status(400).send('Webhook Error: Invalid signing secret')
  }
  const eventType = evt.type

  let user: UserDocument | null
  switch (eventType) {
    // case "session.created": {
    //   break;
    // }
    // case "session.ended": {
    //   break;
    // }
    // case "session.removed": {
    //   break;
    // }
    // case "session.revoked": {
    //   break;
    // }
    // case "email.created": {
    //   break;
    // }
    case 'user.created': {
      if (!evt.data.username) {
        return reply.status(400).send('Webhook Error: Missing username')
      }

      if (!evt.data.email_addresses || !evt.data.email_addresses.length) {
        return reply.status(400).send('Webhook Error: Missing emailAddress')
      }

      const email = evt.data.email_addresses[0].email_address

      const normalizedEmail = normalizeGmailAddress(email)
      const existingUser = await User.findOne({
        normalizedEmail: normalizedEmail,
      })

      // Check if the normalized email already exists
      // If the existing user is found, delete the newly created user from Clerk.
      if (existingUser) {
        server.log.error({
          reason:
            'User with the normalized @gmail address already exists (dot-trick prevention)',
          existingUser,
        })

        await server.clerk?.users.deleteUser(evt.data.id)
        return reply.status(500).send('Webhook Error: Duplicate E-Mail address')
      }

      // Check if the  email is somehow blacklsited
      // If so, delete the newly created user from Clerk.
      const cleanedEmail = replaceDotsInEmailAddress(email)
      const blacklistedEmail = BLACKLIST.some(blacklist =>
        blacklist.words.some(
          word =>
            cleanedEmail.includes(word) &&
            (blacklist.domain
              ? blacklist.domain === cleanedEmail.split('@')[1]
              : true),
        ),
      )

      if (blacklistedEmail) {
        server.log.error({
          reason: 'User with the blacklisted email address',
          email,
        })

        await server.clerk?.users.deleteUser(evt.data.id)
        return reply
          .status(500)
          .send('Webhook Error: Blacklisted E-Mail address')
      }

      // Create new user
      await createNewUser(server, {
        userId: evt.data.id,
        username: evt.data.username,
        userImage: evt.data.image_url,
        email: email,
        normalizedEmail: normalizedEmail,
        isWeb2: false,
        isAdmin: false,
      })

      // Send welcome email to the new user
      try {
        await sendWelcomeEmail(server, email, evt.data.username)
      } catch (error) {
        server.log.error({
          reason: 'Failed to send welcome email',
          error,
          userId: evt.data.id,
        })
        // Don't fail the signup process if email fails
      }

      return reply.status(200).send({})
    }
    case 'user.updated': {
      user = await User.findOne({
        userId: evt.data.id,
      })
      if (!user) {
        return reply.status(400).send('Webhook Error: User not found')
      }
      user.username = evt.data.username || user.username
      user.userImage = evt.data.image_url || user.userImage
      await user.save()
      return reply.status(200).send({})
    }
    case 'user.deleted': {
      user = await User.findOne({
        userId: evt.data.id,
      })
      if (!user) {
        return reply.status(400).send('Webhook Error: User not found')
      }
      user.deleted = true
      await user.save()
      return reply.status(200).send({})
    }
    default:
      return reply.status(400).send('Webhook Error: Invalid event type')
  }
}
