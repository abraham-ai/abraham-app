import { Agent } from '../../../models/Agent'
import { Deployment } from '../../../models/Deployment'
import { Manna } from '../../../models/Manna'
import { Transaction } from '../../../models/Transaction'
import { User } from '../../../models/User'
import { CreationV2 } from '../../../models/v2/CreationV2'
import axios from 'axios'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

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
        redirect_uri: `${server.config.API_URL}/v2/auth/discord/callback`,
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
    const existingUsers = await User.find({ discordId })

    // Check if any existing user has this Discord ID
    for (const existingUser of existingUsers) {
      if (
        existingUser.userId &&
        existingUser._id.toString() !== user._id.toString()
      ) {
        return reply.status(400).send({
          message: 'This Discord account is already connected to another user',
        })
      }
    }

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
    await CreationV2.updateMany(
      {
        'attributes.discordId': discordId.toString(),
        user: { $ne: user._id },
      },
      { $set: { user: user._id } },
    )

    return reply.redirect(
      `${server.config.EDEN2_FRONTEND_URL}/settings/integrations`,
    )
  } catch (error) {
    console.error(error)
    return reply
      .status(500)
      .send({ message: 'Failed to exchange code for token' })
  }
}

export const twitterOAuth = async (
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
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: server.config.TWITTER_CLIENT_ID as string,
        redirect_uri: `${server.config.API_URL}/v2/auth/twitter/callback`,
        code_verifier: 'challenge', // This matches what we sent in the auth request
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: server.config.TWITTER_CLIENT_ID as string,
          password: server.config.TWITTER_CLIENT_SECRET as string,
        },
      },
    )

    const { access_token } = tokenResponse.data

    // Get user's Twitter info
    const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    const twitterHandle = userResponse.data.data.username
    const twitterId = userResponse.data.data.id

    if (!twitterHandle || !twitterId) {
      return reply.status(400).send({
        message: 'Twitter username or ID not found',
      })
    }

    // Check if this Twitter handle is already connected to another account
    const existingUser = await User.findOne({ twitterId })
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return reply.status(400).send({
        message: 'This Twitter account is already connected to another user',
      })
    }

    // Save Twitter handle to user
    user.twitterHandle = twitterHandle
    user.twitterId = twitterId

    if (!user.twitterLinkBonusClaimed) {
      const manna = await Manna.findOneAndUpdate(
        { user: user._id },
        { $inc: { balance: server.config.MANNA_BONUS_TWITTER_LINK } },
      )
      user.twitterLinkBonusClaimed = true
      if (manna) {
        const transaction = new Transaction({
          manna: manna._id,
          amount: server.config.MANNA_BONUS_TWITTER_LINK,
          type: 'twitter_link_bonus',
        })
        await transaction.save()
      }
    }

    await user.save()

    return reply.redirect(
      `${server.config.EDEN2_FRONTEND_URL}/settings/integrations`,
    )
  } catch (error) {
    console.error(
      'Twitter OAuth error:',
      (error as any).response?.data || error,
    )
    return reply
      .status(500)
      .send({ message: 'Failed to connect Twitter account' })
  }
}

export const disconnectTwitter = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const user = await User.findById(request.user.userId)

    if (!user) {
      return reply.status(404).send({
        message: 'User not found',
      })
    }

    // Remove Twitter handle from user
    user.twitterHandle = undefined
    await user.save()

    return reply.status(200).send({
      message: 'Twitter account disconnected successfully',
    })
  } catch (error) {
    console.error('Twitter disconnect error:', error)
    return reply
      .status(500)
      .send({ message: 'Failed to disconnect Twitter account' })
  }
}

export const tiktokOAuth = async (
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

  // State contains the agentId
  const agentId = state

  try {
    // Get agent to find the owner
    const agent = await Agent.findById(agentId)
    if (!agent) {
      return reply.status(404).send({
        message: 'Agent not found',
      })
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://open.tiktokapis.com/v2/oauth/token/',
      new URLSearchParams({
        client_key: server.config.TIKTOK_CLIENT_KEY as string,
        client_secret: server.config.TIKTOK_CLIENT_SECRET as string,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${server.config.API_URL}/v2/auth/tiktok/callback`,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    const { access_token, refresh_token, expires_in, open_id } =
      tokenResponse.data

    // Validate that we have the required credentials
    if (!access_token || !open_id) {
      console.error(
        'Invalid credentials received from TikTok',
        tokenResponse.data,
      )
      console.error('Access token:', access_token)
      console.error('Open ID:', open_id)
      return reply.status(400).send({
        message: 'Invalid credentials received from TikTok',
      })
    }

    // Get user info to get username
    let username = ''
    try {
      const userInfoResponse = await axios.get(
        'https://open.tiktokapis.com/v2/user/info/',
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
          params: {
            fields: 'display_name,username',
          },
        },
      )

      if (userInfoResponse.data?.data?.user) {
        username = userInfoResponse.data.data.user.username
      }
    } catch (error) {
      // Username is optional, continue without it
    }

    // Deploy the TikTok integration using the deployAgent logic
    const tiktokSecrets = {
      access_token,
      refresh_token,
      open_id,
      expires_at: new Date(Date.now() + expires_in * 1000),
      username,
    }

    const modalRequest = {
      endpoint: `${server.config.EDEN_COMPUTE_API_URL}/v2/deployments/create`,
      data: {
        agent: agentId,
        user: agent.owner,
        platform: 'tiktok',
        secrets: { tiktok: tiktokSecrets },
        config: { tiktok: {} },
      },
    }

    await axios.post(modalRequest.endpoint, modalRequest.data, {
      headers: {
        Authorization: `Bearer ${server.config.EDEN_COMPUTE_API_KEY}`,
      },
    })

    // Redirect back to agent settings
    const redirectUrl = `${server.config.EDEN2_FRONTEND_URL}/chat/${agent.username}?page=settings&tab=integrations`

    return reply.redirect(redirectUrl)
  } catch (error) {
    console.error('TikTok OAuth error:', error)
    return reply
      .status(500)
      .send({ message: 'Failed to connect TikTok account' })
  }
}

export const disconnectTikTok = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    const { agentId } = request.query as { agentId: string }

    if (!agentId) {
      return reply.status(400).send({
        message: 'Missing agentId',
      })
    }

    // Remove TikTok deployment
    await Deployment.deleteOne({
      agent: agentId,
      platform: 'tiktok',
    })

    return reply.status(200).send({
      message: 'TikTok account disconnected successfully',
    })
  } catch (error) {
    console.error('TikTok disconnect error:', error)
    return reply
      .status(500)
      .send({ message: 'Failed to disconnect TikTok account' })
  }
}
