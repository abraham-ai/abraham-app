import mailchimpTransactional, {
  MessagesSendRequest,
} from '@mailchimp/mailchimp_transactional'
import { FastifyInstance } from 'fastify'

export async function sendLoraTrainingCompletedEmail(
  server: FastifyInstance,
  email: string,
  loraName: string,
  loraUrl?: string,
  name?: string,
): Promise<any> {
  const apiKey = server.config.MAILCHIMP_API_KEY || ''

  if (!apiKey) {
    throw new Error('Mailchimp API key is required')
  }

  const client = mailchimpTransactional(apiKey)

  try {
    const message: MessagesSendRequest['message'] = {
      to: [
        {
          email,
          name,
          type: 'to',
        },
      ],
      from_email: server.config.EMAIL_FROM,
      from_name: server.config.EMAIL_FROM_NAME,
      subject: `Your Model "${loraName}" is Ready to Use!`,
      html: `
        <p>Hello ${name ? name : 'there'},</p>
        <p>Great news! Your model <strong>${loraName}</strong> has successfully completed training and is now ready to use.</p>
        ${
          loraUrl
            ? `<p>You can access your model here: <a href="${loraUrl}" style="color: #3b82f6; text-decoration: underline;">View ${loraName} Model</a></p>`
            : ''
        }
        <p>Your custom model will help you achieve more consistent results based on your training data, making your creative vision easier to achieve.</p>
        <p>Happy creating!</p>
        <p>Best regards,<br>The Eden Team</p>
      `,
    }

    await client.messages.send({
      message,
    })
  } catch (error) {
    console.log('Failed to send Lora training completion email', error)
    throw error
  }
}

export async function sendWelcomeEmail(
  server: FastifyInstance,
  email: string,
  name?: string,
): Promise<any> {
  const apiKey = server.config.MAILCHIMP_API_KEY || ''

  if (!apiKey) {
    throw new Error('Mailchimp API key is required')
  }

  const client = mailchimpTransactional(apiKey)

  try {
    const message: MessagesSendRequest['message'] = {
      to: [
        {
          email,
          name,
          type: 'to',
        },
      ],
      from_email: server.config.EMAIL_FROM,
      from_name: server.config.EMAIL_FROM_NAME,
      subject: 'Welcome to Eden.art!',
      html: `
        <p>Hello ${name ? name : 'there'},</p>
        <p>Welcome to Eden.art! We're thrilled to see you here.</p>
        <p>If you have any questions or need assistance, don't hesitate to reach out to our support team.</p>
        <p>Happy creating!</p>
        <p>Best regards,<br>The Eden Team</p>
      `,
    }

    await client.messages.send({
      message,
    })
  } catch (error) {
    console.log('Failed to send welcome email', error)
    throw error
  }
}

export async function sendOutOfMannaEmail(
  server: FastifyInstance,
  email: string,
  name?: string,
): Promise<any> {
  const apiKey = server.config.MAILCHIMP_API_KEY || ''

  if (!apiKey) {
    throw new Error('Mailchimp API key is required')
  }

  const client = mailchimpTransactional(apiKey)

  try {
    const message: MessagesSendRequest['message'] = {
      to: [
        {
          email,
          name,
          type: 'to',
        },
      ],
      from_email: server.config.EMAIL_FROM,
      from_name: server.config.EMAIL_FROM_NAME,
      subject: 'You are out of manna!',
      html: `
        <p>Hello ${name ? name : 'there'},</p>
        <p>We noticed you've run out of manna in your Eden.art account. Without manna, you won't be able to perform any tasks.</p>
        <p>Don't let your creative journey stop here - Click <a style="color: #3b82f6; text-decoration: underline;" href="${
          server.config.FRONTEND_URL
        }/settings/subscription">here</a> to subscribe to a plan or purchase additional manna to continue exploring the possibilities with Eden.art!</p>
        <p>Best regards,<br>The Eden Team</p>
      `,
    }

    await client.messages.send({
      message,
    })
  } catch (error) {
    console.log('Failed to send out of manna email', error)
    throw error
  }
}
