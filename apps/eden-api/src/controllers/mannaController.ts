import { checkUserFlags } from '../lib/data'
import { randomId } from '../lib/util'
import { Manna } from '../models/Manna'
import {
  MannaVoucher,
  MannaVoucherDocument,
  VoucherAction,
} from '../models/MannaVoucher'
import { Transaction } from '../models/Transaction'
import { User, UserDocument } from '../models/User'
import { MannaModifyRequestBody } from '../routes/adminRoutes'
import { FeatureFlag, MannaVouchersRedeemArguments } from '@edenlabs/eden-sdk'
import { FastifyReply, FastifyRequest } from 'fastify'

export const modifyManna = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId, amount } = request.body as MannaModifyRequestBody

  const user = await User.findOne({ userId })

  if (!user) {
    return reply.status(400).send({
      message: `User ${userId} not found`,
    })
  }

  const manna = await Manna.findOne({
    user: user._id,
  })
  let newManna

  if (!manna) {
    newManna = new Manna({
      user: user._id,
      balance: amount,
    })
    await newManna.save()
  } else {
    manna.balance += amount
    await manna.save()
    newManna = manna
  }

  const transaction = new Transaction({
    manna: newManna._id,
    amount,
    type: 'admin_modify',
  })
  await transaction.save()

  return reply.status(200).send({
    userId,
    manna: newManna.balance,
    transactionId: transaction._id,
  })
}

interface MannaVoucherCreateRequestBody {
  amount: number
  allowedUserIds?: string[]
  numberOfUses?: number
  code?: string
  action?: VoucherAction
}

const validActions = [
  VoucherAction.AddManna,
  VoucherAction.GrantEden2Access,
  VoucherAction.SubscriptionTrialPro30d,
]

export const createMannaVoucher = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { allowedUserIds, amount, numberOfUses, code, action } =
    request.body as MannaVoucherCreateRequestBody

  if (action) {
    if (!validActions.includes(action)) {
      return reply
        .status(400)
        .send({ message: `Unknown voucher action ${action}` })
    }
  }

  const numVouchers = numberOfUses || 1

  if (numVouchers > 1 && !code) {
    return reply.status(400).send({
      message: 'Code is required if numberOfUses > 1',
    })
  }

  if (numVouchers > 1000) {
    return reply.status(400).send({
      message: `Maximum numberOfUses is 1000, you requested ${numVouchers}`,
    })
  }

  let newCode
  for (let i = 0; i < numVouchers; i++) {
    newCode = code || randomId(16)
    const mannaVoucher = new MannaVoucher({
      allowedUserIds: allowedUserIds || null,
      amount,
      code: newCode,
      action,
    })

    await mannaVoucher.save()
  }

  return reply.status(200).send({
    code: newCode,
  })
}

export const getBalance = async (
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
      message: `User ${userId} not found`,
    })
  }

  const manna = await Manna.findOne({
    user: user._id,
  })

  if (!manna) {
    return reply.status(400).send({
      message: `Manna not found for user ${userId}`,
    })
  }

  return reply.status(200).send({
    balance: manna.balance,
    subscriptionBalance: manna.subscriptionBalance ?? 0,
  })
}

export const redeemMannaVoucher = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const userId = request.user.userId
  const { code } = request.body as MannaVouchersRedeemArguments

  const user = await User.findById(userId)

  if (!user) {
    return reply.status(400).send({
      message: `User ${userId} not found`,
    })
  }

  const mannaVouchersAll = await MannaVoucher.findOne({
    code,
  })

  if (!mannaVouchersAll) {
    return reply.status(400).send({
      message: `Voucher ${code} not found`,
    })
  }

  const mannaVouchersUsedByUser = await MannaVoucher.find({
    code: code,
    redeemedBy: user._id,
  })

  if (mannaVouchersUsedByUser.length > 0) {
    return reply.status(400).send({
      message: `User has already redeemed this voucher`,
    })
  }

  const mannaVoucher = await MannaVoucher.findOne({
    code,
    used: false,
  }).collation({
    locale: 'en',
    strength: 2,
  })

  if (!mannaVoucher) {
    return reply.status(400).send({
      message: `Manna voucher ${code} already finished`,
    })
  }

  if (
    mannaVoucher.allowedUserIds &&
    !mannaVoucher.allowedUserIds.includes(user.userId)
  ) {
    return reply.status(400).send({
      message: `User not in allow list of this voucher`,
    })
  }

  if (!mannaVoucher.action || mannaVoucher.action === VoucherAction.AddManna) {
    return handleMannaVoucher(reply, user, mannaVoucher)
  }

  switch (mannaVoucher.action) {
    case VoucherAction.GrantEden2Access: {
      return handleEden2AccessVoucher(reply, user, mannaVoucher)
    }
    default:
      return reply
        .status(400)
        .send({ message: `Unhandled voucher action: ${mannaVoucher.action}` })
  }
}

const handleEden2AccessVoucher = async (
  reply: FastifyReply,
  user: UserDocument,
  voucher: MannaVoucherDocument,
) => {
  if (checkUserFlags(user.featureFlags, FeatureFlag.Eden2EarlyAccess)) {
    return reply
      .status(400)
      .send({ message: 'User already has Early Access flag' })
  }

  // update user document
  user.featureFlags = [
    ...(user.featureFlags || []),
    FeatureFlag.Eden2EarlyAccess,
  ]
  await user.save()

  // update voucher document
  voucher.used = true
  voucher.redeemedBy = user._id
  await voucher.save()

  return reply.status(200).send({
    action: 'Early access granted',
    success: true,
  })
}

const handleMannaVoucher = async (
  reply: FastifyReply,
  user: UserDocument,
  voucher: MannaVoucherDocument,
) => {
  const manna = await Manna.findOne({ user: user._id })

  let newBalance
  let mannaId

  if (!manna) {
    const newManna = new Manna({
      user: user._id,
      balance: voucher.amount,
    })
    newBalance = newManna.balance
    mannaId = newManna._id
    await newManna.save()
  } else {
    manna.balance += voucher.amount
    newBalance = manna.balance
    mannaId = manna._id
    await manna.save()
  }

  const transaction = new Transaction({
    manna: mannaId,
    amount: voucher.amount,
    type: 'credit_voucher',
    voucher: voucher._id,
    code: voucher.code,
  })
  await transaction.save()

  voucher.used = true
  voucher.redeemedBy = user._id
  await voucher.save()

  return reply.status(200).send({
    action: 'Manna voucher redeemed',
    manna: newBalance,
    transactionId: transaction._id,
  })
}
