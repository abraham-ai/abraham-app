// import {
//   AuthCreateChallengeArguments,
//   AuthLoginArguments,
// } from '@edenlabs/eden-sdk'
// import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
// import { generateNonce } from 'siwe'

// import Challenge from '../../models/Challenge'
// import { UserInput } from '../../models/Creator'
// import {
//   createNewUser,
//   getAuthAllowlist,
//   validateChallenge,
// } from './authController'

// export const web3login = async (
//   server: FastifyInstance,
//   request: FastifyRequest,
//   reply: FastifyReply,
// ) => {
//   const { address, signature, message } = request.body as AuthLoginArguments

//   const allowlist = getAuthAllowlist(server)
//   if (allowlist && !allowlist.includes(address)) {
//     return reply.status(401).send({
//       message: 'Address not in allowlist',
//     })
//   }

//   const result = await validateChallenge(address, message, signature, reply)
//   let { authUser } = result
//   const { challenge } = result

//   // create a new user if none found
//   if (!authUser) {
//     const userInput: UserInput = {
//       userId: address,
//       username: address,
//       isWeb2: challenge.isWeb2,
//     }
//     authUser = await createNewUser(userInput)
//   }

//   const token = await reply.jwtSign({
//     userId: authUser._id,
//     isAdmin: false,
//   })

//   // mark the challenge as acknowledged
//   challenge.ack = true
//   await challenge.save()

//   return reply.status(200).send({
//     token,
//   })
// }

// export const createChallenge = async (
//   server: FastifyInstance,
//   request: FastifyRequest,
//   reply: FastifyReply,
// ) => {
//   const { address, isWeb2 } = request.body as AuthCreateChallengeArguments

//   const allowlist = getAuthAllowlist(server)
//   if (allowlist && !allowlist.includes(address)) {
//     return reply.status(401).send({
//       message: 'Address not in allowlist',
//     })
//   }

//   const nonce = generateNonce()

//   await Challenge.create({
//     address,
//     isWeb2,
//     nonce,
//   })

//   return reply.status(200).send({
//     nonce,
//   })
// }

export {}
