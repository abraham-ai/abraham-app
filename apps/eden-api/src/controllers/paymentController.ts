import { trackCheckoutBegin, trackCheckoutComplete } from '../lib/analytics'
import { getAdminHeaders } from '../lib/util'
import { Manna } from '../models/Manna'
import { Transaction } from '../models/Transaction'
import { User, UserDocument } from '../models/User'
import {
  PaymentsCreateArguments,
  PaymentsSubscriptionArguments,
  SubscriptionTier,
} from '@edenlabs/eden-sdk'
import axios from 'axios'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import Stripe from 'stripe'

interface StripeDataObject {
  eventId: string
  eventType: string
  eventData: Stripe.Event.Data
  userId: string
  customerId: string
  sessionId: string
  productId: string
  renewalPriceId?: string
  current_period_start?: number
  current_period_end?: number
}

interface TopUpMetadata {
  manna: string
  analyticsClientId?: string
}

interface SubscriptionMetadata {
  subscriptionTier: string
  manna: string
  analyticsClientId?: string
}

const discountMap = (
  server: FastifyInstance,
  subscriptionTier?: SubscriptionTier,
) => {
  const map = {
    [SubscriptionTier.Free]: undefined,
    [SubscriptionTier.Basic]: server.config.STRIPE_DISCOUNT_CODE_BASIC,
    [SubscriptionTier.Pro]: server.config.STRIPE_DISCOUNT_CODE_PRO,
    [SubscriptionTier.Believer]: server.config.STRIPE_DISCOUNT_CODE_BELIEVER,
    [SubscriptionTier.Admin]: undefined,
  }
  return map[subscriptionTier || SubscriptionTier.Free]
}

const mannaTierMap = (subscriptionTier?: SubscriptionTier) => {
  const map = {
    [SubscriptionTier.Free]: 0,
    [SubscriptionTier.Basic]: 1000,
    [SubscriptionTier.Pro]: 5000,
    [SubscriptionTier.Believer]: 10000,
    [SubscriptionTier.Admin]: 0,
  }
  return map[subscriptionTier || SubscriptionTier.Free]
}

const updateStripeCustomer = async (
  server: FastifyInstance,
  user: UserDocument,
  session: Stripe.Checkout.Session,
) => {
  // update metadata of stripe customer
  if (!server.stripe) {
    throw new Error('Stripe is not configured')
  }

  const customerId = session.customer?.toString()
  if (!customerId) {
    throw new Error('No customer id found')
  }

  const stripeCustomer = await server.stripe.customers.retrieve(customerId)

  if (!stripeCustomer) {
    throw new Error('Stripe customer not found')
  }

  await server.stripe.customers.update(customerId, {
    metadata: {
      edenUserId: user.userId,
    },
  })

  // Update the user in the database
  user.stripeCustomerId = customerId
  await user.save()
}

const handleTopUp = async (
  server: FastifyInstance,
  reply: FastifyReply,
  metadata: TopUpMetadata,
  user: UserDocument,
  stripeEventData: StripeDataObject,
) => {
  const { eventId, eventType, eventData } = stripeEventData

  const mannaAmount = metadata.manna
  if (!mannaAmount) {
    return reply.status(400).send({
      message: 'No manna amount found',
    })
  }

  if (!eventId) {
    return reply.status(400).send({
      message: 'No eventId found in payload',
    })
  }

  if (!eventType) {
    return reply.status(400).send({
      message: 'No eventType found in payload',
    })
  }

  if (!eventData) {
    return reply.status(400).send({
      message: 'No eventData found in payload',
    })
  }

  let mannaAmountInt: number
  try {
    mannaAmountInt = parseInt(mannaAmount)
  } catch (error) {
    return reply.status(400).send({
      message: 'Invalid manna amount',
    })
  }

  await axios.post(
    `${server.config.API_URL}/admin/manna/modify`,
    {
      userId: user.userId,
      amount: mannaAmountInt,
    },
    {
      headers: getAdminHeaders(server),
    },
  )

  return reply.status(200).send({})
}

const handleNewSubscription = async (
  //@ts-ignore - unused
  server: FastifyInstance,
  reply: FastifyReply,
  metadata: SubscriptionMetadata,
  user: UserDocument,
  stripeEventData: StripeDataObject,
  proration?: number,
) => {
  const subscriptionTier = parseInt(metadata.subscriptionTier)
  let mannaAmountInt: number

  try {
    await user.updateOne({
      subscriptionTier,
      highestMonthlySubscriptionTier: subscriptionTier,
    })

    try {
      const previousTierManna = mannaTierMap(user.subscriptionTier || undefined)
      const newTierManna = mannaTierMap(subscriptionTier)
      mannaAmountInt = Math.ceil(
        (newTierManna - previousTierManna) * (proration || 1),
      )
    } catch (error) {
      return reply.status(400).send({
        message: 'Invalid manna amount',
      })
    }

    if (mannaAmountInt > 0) {
      try {
        if (mannaAmountInt > 0) {
          const manna = await Manna.findOne({
            user: user._id,
          })

          if (!manna) {
            return reply.status(400).send({
              message: 'Manna not found',
            })
          }

          try {
            const existingTransaction = await Transaction.exists({
              stripeEventType: stripeEventData.eventType,
              stripeEventId: stripeEventData.eventId,
            })

            if (existingTransaction !== null) {
              return reply.status(500).send({
                message: `Error inserting transaction, eventId already exists: ${stripeEventData.eventId} | ${stripeEventData.eventType}`,
              })
            }

            const transaction = new Transaction({
              stripeEventId: stripeEventData.eventId,
              stripeEventType: stripeEventData.eventType,
              stripeEventData: stripeEventData.eventData,
              type: 'credit_stripe',
              manna: manna._id,
              amount: mannaAmountInt,
            })
            await transaction.save()
          } catch (e) {
            return reply.status(500).send({
              message: 'Error inserting transaction, manna not updated',
            })
          }

          if (!manna.subscriptionBalance) {
            manna.subscriptionBalance = mannaAmountInt
          } else {
            manna.subscriptionBalance += mannaAmountInt
          }
          await manna.save()
        }
      } catch (error) {
        return reply.status(500).send({
          message: 'Error adding manna',
        })
      }
    }

    return reply.status(200).send({
      message: 'new subscription created',
      newSubscriptionTier: subscriptionTier,
      existingTier: user.subscriptionTier,
      highestTier: user.highestMonthlySubscriptionTier,
    })
  } catch (error) {
    console.error(error)
    return reply.status(500).send({
      message: 'Error updating subscription',
      newSubscriptionTier: subscriptionTier,
      existingTier: user.subscriptionTier,
      highestTier: user.highestMonthlySubscriptionTier,
    })
  }
}

type GenericStripeEventDataObject = {
  [K in keyof Stripe.Event.Data.Object]?: any
}

const handleSubscriptionUpdated = async (
  server: FastifyInstance,
  reply: FastifyReply,
  stripeEventData: StripeDataObject,
  rawStripeEventDataObject: Stripe.Event.Data.Object,
  previousAttributes?: Stripe.Event.Data.PreviousAttributes,
) => {
  const {
    customerId,
    productId,
    current_period_end,
    current_period_start,
    eventId,
    eventType,
    eventData,
  } = stripeEventData

  if (!server.stripe) {
    return reply.status(500).send({
      message: 'Stripe is not configured',
    })
  }

  if (!eventId) {
    return reply.status(400).send({
      message: 'No eventId found in payload',
    })
  }

  if (!eventType) {
    return reply.status(400).send({
      message: 'No eventType found in payload',
    })
  }

  if (!eventData) {
    return reply.status(400).send({
      message: 'No eventData found in payload',
    })
  }

  const user = await User.findOne({
    stripeCustomerId: customerId,
  })

  if (!user) {
    return reply.status(404).send({
      message: 'User not found',
    })
  }

  const product = await server.stripe.products.retrieve(productId)

  if (!product || !product.metadata) {
    return reply.status(400).send({
      message: 'No metadata found',
    })
  }

  if (product.metadata.subscriptionTier === undefined) {
    return reply.status(400).send({
      message: 'Product metadata is missing subscription tier',
    })
  }

  const metadata = {
    subscriptionTier: product.metadata.subscriptionTier,
    manna: product.metadata.manna,
  }

  // is this update trying to upgrade the tier?
  if (
    parseInt(metadata.subscriptionTier) >
    (user.highestMonthlySubscriptionTier || 0)
  ) {
    const currentDate = Math.floor(Date.now() / 1000) // Convert to seconds since Stripe uses seconds

    if (!current_period_end || !current_period_start) {
      return reply.status(400).send({
        message: 'No current period found',
      })
    }

    const totalSecondsInCurrentPeriod =
      current_period_end - current_period_start
    const secondsLeftInCurrentPeriod = current_period_end - currentDate

    const proration = secondsLeftInCurrentPeriod / totalSecondsInCurrentPeriod

    await handleNewSubscription(
      server,
      reply,
      metadata,
      user,
      stripeEventData,
      proration,
    )
  } else {
    // nothing to do here, report acknowledgement

    // gather updates
    const updatedAttributes: GenericStripeEventDataObject = {}
    if (previousAttributes && rawStripeEventDataObject) {
      Object.keys(previousAttributes).forEach(attributeKey => {
        if (attributeKey in rawStripeEventDataObject) {
          updatedAttributes[
            attributeKey as keyof GenericStripeEventDataObject
          ] =
            rawStripeEventDataObject[
              attributeKey as keyof GenericStripeEventDataObject
            ]
        }
      })
    }

    return reply.status(200).send({
      message:
        'noop - event is informal change to subscription (renewal date change, address, ...)',
      previousAttributes: previousAttributes || {},
      updatedAttributes,
    })
    // return reply.status(400).send({
    //   message: `New subscription tier is equal or lower current tier, no-op - metadata:${metadata.subscriptionTier} | highestMonthlySubscriptionTier:${user.highestMonthlySubscriptionTier || 0}`,
    // })
  }
}

const handleSubscriptionDeleted = async (
  server: FastifyInstance,
  reply: FastifyReply,
  { customerId }: StripeDataObject,
) => {
  const user = await User.findOne({
    stripeCustomerId: customerId,
  })

  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  if (!server.stripe) {
    return reply.status(500).send({
      message: 'Stripe is not configured',
    })
  }

  try {
    user.subscriptionTier = SubscriptionTier.Free
    user.highestMonthlySubscriptionTier = SubscriptionTier.Free
    await user.save()

    return reply.status(200).send({})
  } catch (error) {
    return reply.status(500).send({
      message: 'Error updating subscription',
    })
  }
}

const handleRenewal = async (
  server: FastifyInstance,
  reply: FastifyReply,
  stripeEventData: StripeDataObject,
) => {
  const { customerId, renewalPriceId, eventId, eventType, eventData } =
    stripeEventData

  console.log('Handling renewal')
  if (!server.stripe) {
    return reply.status(500).send({
      message: 'Stripe is not configured',
    })
  }

  if (!eventId) {
    return reply.status(400).send({
      message: 'No eventId found in payload',
    })
  }

  if (!eventType) {
    return reply.status(400).send({
      message: 'No eventType found in payload',
    })
  }

  if (!eventData) {
    return reply.status(400).send({
      message: 'No eventData found in payload',
    })
  }

  if (!renewalPriceId) {
    return reply.status(400).send({
      message: 'No renewal price id found',
    })
  }

  const price = await server.stripe.prices.retrieve(renewalPriceId, {
    expand: ['product'],
  })
  const product = price.product as Stripe.Product

  if (!product) {
    return reply.status(400).send({
      message: 'No product found',
    })
  }

  if (
    !product.metadata ||
    !product.metadata.subscriptionTier ||
    !product.metadata.manna
  ) {
    return reply.status(400).send({
      message: 'No metadata found',
    })
  }

  const metadata = {
    subscriptionTier: product.metadata.subscriptionTier,
    manna: product.metadata.manna,
  }

  console.log('Metadata', metadata)

  const user = await User.findOne({
    stripeCustomerId: customerId,
  })

  console.log(user)

  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  const subscriptionTier = parseInt(metadata.subscriptionTier)
  user.subscriptionTier = subscriptionTier
  user.highestMonthlySubscriptionTier = subscriptionTier
  await user.save()

  console.log('User', user)

  const manna = await Manna.findOne({
    user: user._id,
  })

  if (!manna) {
    return reply.status(400).send({
      message: 'Manna not found',
    })
  }

  let mannaAmountInt: number
  try {
    mannaAmountInt = parseInt(metadata.manna)
  } catch (error) {
    return reply.status(400).send({
      message: 'Invalid manna amount',
    })
  }

  console.log('Manna amount', mannaAmountInt)

  const newAmount = Math.max(manna.subscriptionBalance || 0, mannaAmountInt)

  console.log('New amount', newAmount)
  if (newAmount > 0) {
    manna.subscriptionBalance = newAmount

    try {
      const existingTransaction = await Transaction.exists({
        stripeEventType: eventType,
        stripeEventId: eventId,
      })

      if (existingTransaction !== null) {
        return reply.status(500).send({
          message: `Error inserting transaction, eventId already exists: ${eventId} | ${eventType}`,
        })
      }

      const transaction = new Transaction({
        stripeEventId: eventId,
        stripeEventType: eventType,
        stripeEventData: eventData,
        type: 'credit_stripe',
        manna: manna._id,
        amount: newAmount - (manna.subscriptionBalance || 0),
      })
      await transaction.save()
    } catch (e) {
      return reply.status(500).send({
        message: 'Error inserting transaction, manna not updated',
      })
    }

    await manna.save()
  }

  return reply.status(200).send({})
}

const handlePaymentSuccess = async (
  server: FastifyInstance,
  reply: FastifyReply,
  stripeEventData: StripeDataObject,
  rawStripeEventDataObject: Stripe.Event.Data.Object,
) => {
  const { userId, sessionId, eventId, eventType, eventData } = stripeEventData

  if (!server.stripe) {
    return reply.status(500).send({
      message: 'Stripe is not configured',
    })
  }

  if (!eventId) {
    return reply.status(400).send({
      message: 'No eventId found in payload',
    })
  }

  if (!eventType) {
    return reply.status(400).send({
      message: 'No eventType found in payload',
    })
  }

  if (!eventData) {
    return reply.status(400).send({
      message: 'No eventData found in payload',
    })
  }

  const user = await User.findOne({
    userId,
  })

  if (!user) {
    return reply.status(400).send({
      message: 'User not found',
    })
  }

  const session = await server.stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items.data.price.product'],
  })
  if (
    !session.line_items ||
    session.line_items.data.length === 0 ||
    !session.line_items.data[0].price ||
    !session.line_items.data[0].price.product
  ) {
    return reply.status(400).send({
      message: 'No line items found',
    })
  }

  await updateStripeCustomer(server, user, session)

  // @ts-ignore
  const metadata = session.line_items.data[0].price.product.metadata
  if (!metadata) {
    return reply.status(400).send({
      message: 'No metadata found',
    })
  }

  if (metadata.subscriptionTier) {
    await handleNewSubscription(
      server,
      reply,
      metadata as SubscriptionMetadata,
      user,
      stripeEventData,
    )
  } else {
    await handleTopUp(
      server,
      reply,
      metadata as TopUpMetadata,
      user,
      stripeEventData,
    )
  }

  const sessionMetaData =
    //@ts-ignore
    rawStripeEventDataObject && rawStripeEventDataObject.metadata
      ? //@ts-ignore
        rawStripeEventDataObject.metadata
      : {}
  await trackCheckoutComplete(server, sessionMetaData.analyticsClientId || '', {
    transaction_id: sessionId,
    currency: session.currency || '',
    value:
      session.amount_total !== null
        ? (session.amount_total - (session?.total_details?.amount_tax || 0)) /
          100
        : 0,
    tax: session?.total_details?.amount_tax || 0,
    items: session.line_items.data.map((item: Stripe.LineItem, index) => {
      return {
        item_id: item.id,
        item_name:
          (metadata.subscriptionTier ? 'subscription' : 'top-up') +
          ' - ' +
          item.description,
        currency: item.currency.toUpperCase(),
        index: index,
        item_brand: 'Eden',
        item_category: metadata.subscriptionTier ? 'subscription' : 'top-up',
        // amount from stripe as integer needs to be a float for GA
        price:
          item.price?.unit_amount && item.price?.unit_amount > 0
            ? item.price?.unit_amount / 100
            : 0,
        quantity: item.quantity || 0,
      }
    }),
  })
}

export const createCheckoutSession = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const { priceId, paymentMode, analyticsClientId, returnUrl } =
    request.body as PaymentsCreateArguments

  const user = await User.findById(userId)
  if (!user) {
    return reply.status(400).send({
      message: `User ${userId} not found`,
    })
  }

  if (!priceId) {
    return reply.status(400).send({
      message: 'You must provide a priceId',
    })
  }

  if (!server.stripe) {
    return reply.status(500).send({
      message: 'Stripe is not configured',
    })
  }

  const customer_creation =
    paymentMode === 'payment' && !user.stripeCustomerId ? 'always' : undefined

  const discountCode = discountMap(server, user.subscriptionTier)

  const session = await server.stripe.checkout.sessions.create({
    mode: paymentMode,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    discounts:
      paymentMode === 'payment' && discountCode
        ? [{ coupon: discountCode }]
        : undefined,
    customer_creation,
    customer: user.stripeCustomerId,
    client_reference_id: user.userId,
    success_url: `${
      returnUrl ? returnUrl : server.config.EDEN2_FRONTEND_URL
    }/order/success?session_id={CHECKOUT_SESSION_ID}&gacid=${analyticsClientId}`,
    cancel_url: `${
      returnUrl ? returnUrl : server.config.EDEN2_FRONTEND_URL
    }/order/cancelled?session_id={CHECKOUT_SESSION_ID}&gacid=${analyticsClientId}`,
    metadata: {
      analyticsClientId: analyticsClientId || '',
    },
  })

  await trackCheckoutBegin(server, analyticsClientId || '')

  return reply.status(200).send({
    url: session.url,
  })
}

export const createSubscriptionSession = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const { userId } = request.user || {}
  if (!userId) {
    return reply.status(400).send({
      message: 'User missing from request',
    })
  }

  const { stripeCustomerId, returnUrl } =
    request.body as PaymentsSubscriptionArguments

  if (!server.stripe) {
    return reply.status(500).send({
      message: 'Stripe is not configured',
    })
  }

  // get stripe customer
  const customer = await server.stripe.customers.retrieve(stripeCustomerId)
  const user = await User.findById(userId)

  // make sure customer matches user
  // @ts-ignore
  if (customer.metadata.edenUserId !== user.userId) {
    return reply.status(400).send({
      message: 'Customer does not match user',
    })
  }

  const session = await server.stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl ? returnUrl : `${server.config.FRONTEND_URL}`,
  })

  return reply.status(200).send({
    url: session.url,
  })
}

export const handlePaymentEvent = async (
  server: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (!server.stripe) {
    return reply.status(500).send({
      message: 'Stripe is not configured',
    })
  }

  if (!request.rawBody) {
    return reply.status(400).send({
      message: 'Raw body not configured',
    })
  }

  const sig = request.headers['stripe-signature'] as string

  const event = server.stripe.webhooks.constructEvent(
    request.rawBody,
    sig,
    server.config.STRIPE_WEBHOOK_SECRET,
  )

  const dataObject = event.data.object
  const previousAttributes = event.data.previous_attributes
  // @ts-ignore
  const userId = dataObject.client_reference_id
  // @ts-ignore
  const customerId = dataObject.customer
  // @ts-ignore
  const sessionId = dataObject.id
  // @ts-ignore
  const productId = dataObject.items?.data[0]?.price?.product
  // @ts-ignore
  const renewalPriceId = dataObject.lines?.data[0]?.price?.id
  // @ts-ignore
  const current_period_end = dataObject.current_period_end
  // @ts-ignore
  const current_period_start = dataObject.current_period_start

  // @ts-ignore
  const billing_reason = dataObject.billing_reason

  const stripeDataObject: StripeDataObject = {
    eventId: event.id,
    eventType: event.type,
    eventData: event.data,
    userId,
    customerId,
    sessionId,
    productId,
    renewalPriceId,
    current_period_start,
    current_period_end,
  }

  switch (event.type) {
    // checkout events
    case 'checkout.session.completed':
      await handlePaymentSuccess(server, reply, stripeDataObject, dataObject)
      return

    case 'invoice.payment_succeeded':
      if (billing_reason !== 'subscription_cycle') {
        return
      }
      await handleRenewal(server, reply, stripeDataObject)
      return

    // subscription events
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(
        server,
        reply,
        stripeDataObject,
        dataObject,
        previousAttributes,
      )
      return

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(server, reply, stripeDataObject)
      return
    default:
      console.log(`Stripe: Unhandled event type ${event.type}`)
      return reply
        .status(200)
        .send({ message: `unhandled event - ${event.type}` })
  }
}

export const getProducts = async (
  server: FastifyInstance,
  reply: FastifyReply,
) => {
  if (!server.stripe) {
    return reply.status(500).send({
      message: 'Stripe is not configured',
    })
  }
  const products = await server.stripe.products.list({})
  const activeProducts = products.data.filter(product => product.active)
  const productsWithPrices = await Promise.all(
    activeProducts.map(async product => {
      // @ts-ignore
      const prices = await server.stripe.prices.list({ product: product.id })
      const defaultPrice = prices.data.find(
        price => price.id === product.default_price,
      )
      const priceToDisplay = defaultPrice || prices.data[0]
      return {
        ...product,
        isSubscription: priceToDisplay.type === 'recurring',
        displayPrice: {
          currency: priceToDisplay.currency,
          unit_amount: priceToDisplay.unit_amount,
          type: priceToDisplay.type,
        },
      }
    }),
  )

  return reply.status(200).send({
    products: productsWithPrices.filter(product => !product.isSubscription),
    subscriptions: productsWithPrices.filter(product => product.isSubscription),
  })
}
