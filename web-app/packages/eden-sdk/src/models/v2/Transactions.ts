import { Manna } from '../Manna'

export type Transaction = {
  _id: string
  manna: Manna
  amount: number
  type?: TransactionType
  task?: string
  voucher?: string
  code?: string
  stripeEventId?: string
  stripeEventType?: string
  // stripeEventData?: Stripe.Event.Data
  createdAt: Date
  uopdatedAt: Date
}

export type TransactionType =
  | 'spend'
  | 'refund'
  | 'credit_stripe'
  | 'credit_voucher'
  | 'admin_modify'
  | 'daily_login_bonus'
  | 'discord_link_bonus'
  | 'twitter_link_bonus'
