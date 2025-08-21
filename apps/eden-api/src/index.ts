import { dummyTaskHandlers } from './lib/taskHandlers/dummy'
import { edenHandlers } from './lib/taskHandlers/edenHandlers'
import { TaskHandlers } from './plugins/tasks'
import createServer from './server' //

const handlersMap: Record<string, TaskHandlers> = {
  development: dummyTaskHandlers,
  staging: edenHandlers,
  production: edenHandlers,
}

process.on('unhandledRejection', err => {
  console.error(err)
  process.exit(1)
})

const main = async () => {
  const server = await createServer({
    taskHandlers: handlersMap[process.env.NODE_ENV || 'development'],
  })
  const port = +server.config.API_PORT
  const host = server.config.API_HOST
  await server.listen({ host, port })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () =>
      server.close().then(err => {
        console.log(`close application on ${signal}`)
        process.exit(err ? 1 : 0)
      }),
    )
  }
}

main()
