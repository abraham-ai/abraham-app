import axios from 'axios'
import { FastifyInstance } from 'fastify'

type AnalyticsEvent = {
  name: string
  params?: { [key: string]: any }
}

type AnalyticsData = {
  client_id: string
  events: AnalyticsEvent[]
}

type AnalyticsCheckoutItem = {
  item_id: string
  item_name: string
  currency: string
  index: number
  item_brand: string
  item_category: string
  item_variant?: string
  price: number
  quantity: number
}

type AnalyticsCheckoutData = {
  currency: string
  transaction_id: string
  value: number
  tax: number
  items: AnalyticsCheckoutItem[]
}

const sendAnalyticsEvents = async (
  server: FastifyInstance,
  data: AnalyticsData,
) => {
  try {
    const response = await axios.post(
      `https://www.google-analytics.com/mp/collect?measurement_id=${server.config.GOOGLE_ANALYTICS_MEASUREMENT_ID}&api_secret=${server.config.GOOGLE_ANALYTICS_API_SECRET}`,
      data,
    )
    console.log('sendAnalyticsEvent', response.status, data)
  } catch (e) {
    console.error(e)
  }
}

export const trackCheckoutComplete = async (
  server: FastifyInstance,
  analyticsClientId: string,
  checkoutData: AnalyticsCheckoutData,
) => {
  console.log('Purchase tracked', analyticsClientId)

  const data = {
    client_id: analyticsClientId,
    events: [
      {
        name: 'purchase',
        params: checkoutData,
      },
    ],
  }

  await sendAnalyticsEvents(server, data)
}

export const trackCheckoutBegin = async (
  server: FastifyInstance,
  analyticsClientId: string,
) => {
  console.log('Checkout Begin tracked', analyticsClientId)

  const data = {
    client_id: analyticsClientId,
    events: [
      {
        name: 'begin_checkout',
      },
    ],
  }

  await sendAnalyticsEvents(server, data)
}
