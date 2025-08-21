import axios from 'axios'
import { FastifyInstance } from 'fastify'

export const registerAirflow = async (fastify: FastifyInstance) => {
  try {
    const airflowOptions = {
      baseURL: fastify.config.AIRFLOW_BASE_URL,
    }

    fastify.decorate('airflow', {
      submitTask: async (opts: {
        dagId: string
        taskId: string
        config?: any
        executionDate?: string
      }) => {
        try {
          const response = await axios.post(
            `${airflowOptions.baseURL}/api/v1/dags/${opts.dagId}/dagRuns`,
            {
              execution_date: opts.executionDate,
              conf: {
                taskId: opts.taskId,
                config: opts.config,
              },
            },
            {
              auth: {
                username: 'admin',
                password: 'admin',
              },
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )

          return response.data
        } catch (error) {
          console.error(error)
          throw new Error('Failed to trigger DAG')
        }
      },
    })

    fastify.log.info('Successfully registered plugin: Airflow')
  } catch (err) {
    fastify.log.error('Plugin: Airflow, error on register', err)
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    airflow?: {
      submitTask: (opts: {
        dagId: string
        taskId: string
        config?: any
        executionDate?: string
      }) => Promise<string>
    }
  }
}

export default registerAirflow
