import { Collection } from '../../models/Collection'
import { Creation } from '../../models/Creation'
import { Manna } from '../../models/Manna'
import { Transaction } from '../../models/Transaction'
import { User, UserInput } from '../../models/User'
import axios from 'axios'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

export const createNewUser = async (
  server: FastifyInstance,
  input: UserInput,
) => {
  const newUser = new User({ ...input, type: 'user' })
  await newUser.save()

  // Give them a default collection
  const collection = new Collection({
    user: newUser._id,
    name: 'Bookmarks',
    description: 'My bookmarked creations',
    isDefaultCollection: true,
  })
  await collection.save()

  // Give them free Manna
  const newManna = new Manna({
    user: newUser._id,
    balance: server.config.MANNA_BONUS_SIGNUP,
  })
  await newManna.save()
  return newUser
}

export const discordOAuth = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { code, state } = request.query as { code: string; state: string }

  if (!code || !state) {
    return reply.status(400).send({
      message: 'Missing code or state',
    })
  }

  const user = await User.findOne({
    userId: state,
  })

  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  try {
    const response = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: server.config.DISCORD_CLIENT_ID as string,
        client_secret: server.config.DISCORD_CLIENT_SECRET as string,
        code,
        redirect_uri: `${server.config.API_URL}/auth/discord/callback`,
        grant_type: 'authorization_code',
        scope: 'identify',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    const { access_token } = response.data

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        authorization: `Bearer ${access_token}`,
      },
    })

    const discordId = userResponse.data.id
    if (!discordId) {
      return reply.status(400).send({
        message: 'Discord user not found',
      })
    }

    // Check to make sure this discordId isn't already in use
    await User.findOne({ discordId }).then(existingUser => {
      if (existingUser) {
        return reply.status(400).send({
          message: 'Discord already in use',
        })
      }
    })

    user.discordId = discordId

    if (!user.discordLinkBonusClaimed) {
      const manna = await Manna.findOneAndUpdate(
        { user: user._id },
        { $inc: { balance: server.config.MANNA_BONUS_DISCORD_LINK } },
      )
      user.discordLinkBonusClaimed = true

      if (manna) {
        const transaction = new Transaction({
          manna: manna._id,
          amount: server.config.MANNA_BONUS_DISCORD_LINK,
          type: 'discord_link_bonus',
        })
        await transaction.save()
      }
    }

    await user.save()

    // Give delegated creations to the user
    const creations = await Creation.find({
      'attributes.discordId': discordId.toString(),
      userId: { $ne: user._id },
    })
    await Promise.all(
      creations.map(async creation => {
        creation.user = user._id
        await creation.save()
      }),
    )

    await Manna.findOneAndUpdate({ user: user._id }, { $inc: { balance: 50 } })

    return reply.redirect(`${server.config.FRONTEND_URL}/account`)
  } catch (error) {
    console.error(error)
    return reply
      .status(500)
      .send({ message: 'Failed to exchange code for token' })
  }
}

export const disconnectDiscord = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const user = await User.findById(userId)

  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  user.discordId = undefined
  await user.save()

  return reply.status(200).send({})
}

export const claimDailyLoginBonus = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}

  if (!userId) {
    return reply.status(401).send({
      message: 'User missing from request',
    })
  }

  const user = await User.findById(userId)

  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  const userManna = await Manna.findOne({ user: user._id })

  if (!userManna) {
    return reply.status(400).send({
      message: 'User manna not found',
    })
  }

  const now = Date.now()
  const lastDailyLogin = user.lastDailyLoginBonus

  const oneDayInMs = 24 * 60 * 60 * 1000
  const claimAmount = server.config.MANNA_BONUS_DAILY_LOGIN

  if (!lastDailyLogin || now - lastDailyLogin.getTime() >= oneDayInMs) {
    await User.updateOne(
      { _id: user._id },
      { $set: { lastDailyLoginBonus: new Date() } },
    )

    userManna.balance += claimAmount
    await userManna.save()

    const transaction = new Transaction({
      manna: userManna._id,
      amount: claimAmount,
      type: 'daily_login_bonus',
    })
    await transaction.save()

    return reply.status(200).send({
      claimed: claimAmount,
    })
  }

  return reply.status(200).send({
    claimed: 0,
    lastDailyLogin: user.lastDailyLoginBonus,
  })
}
