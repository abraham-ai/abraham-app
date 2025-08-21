// import { Product } from '@edenlabs/eden-sdk'
// import { FastifyInstance } from 'fastify'
// import { describe, expect, test } from 'vitest'
// import { prepareUserHeaders } from '../../util'
// type TopupAmount = '100' | '1000' | '10000'
// const getProducts = async (server: FastifyInstance) => {
//   const response = await server.inject({
//     method: 'GET',
//     url: '/payments/products',
//     headers: prepareUserHeaders(),
//   })
//   return response
// }
// const getProduct = async (
//   server: FastifyInstance,
//   mannaAmount: TopupAmount,
// ) => {
//   const response = await getProducts(server)
//   const { products } = response.json() as { products: Product[] }
//   const product = products.find(
//     product => product.metadata.manna === mannaAmount,
//   )
//   return product
// }
// describe('Payments', () => {
//   test('User should be able to buy manna', async context => {
//     // @ts-ignore
//     const { server } = context
//     const product = await getProduct(server, '100')
//     const response = await server.inject({
//       method: 'POST',
//       url: '/payments/create',
//       headers: prepareUserHeaders(),
//       payload: {
//         priceId: product?.default_price,
//         paymentMode: 'payment',
//       },
//     })
//     expect(response.statusCode).eq(200)
//     const json = response.json()
//     expect(json.url).toBeDefined()
//     console.log(json)
//     await server.close()
//   })
//   // test('User should be able to subscribe at basic level', async context => {
//   //   // @ts-ignore
//   //   const { server } = context
//   //   expect(typeof server).eq('xxx')
//   //   await server.close()
//   // })
//   // test('User should be able to subscribe at pro level', async context => {
//   //   // @ts-ignore
//   //   const { server } = context
//   //   expect(typeof server).eq('xxx')
//   //   await server.close()
//   // })
//   // test('User should be able to subscribe at believer level', async context => {
//   //   // @ts-ignore
//   //   const { server } = context
//   //   expect(typeof server).eq('xxx')
//   //   await server.close()
//   // })
//   // test('Use should be charged a pro-rated amount when upgrading subscription', async context => {
//   //   // @ts-ignore
//   //   const { server } = context
//   //   expect(typeof server).eq('xxx')
//   //   await server.close()
//   // })
//   // test('User should receive manna when subscribing to a level', async context => {
//   //   // @ts-ignore
//   //   const { server } = context
//   //   expect(typeof server).eq('xxx')
//   //   await server.close()
//   // })
//   // test('User should receive pro-rated manna when upgrading subscription', async context => {
//   //   // @ts-ignore
//   //   const { server } = context
//   //   expect(typeof server).eq('xxx')
//   //   await server.close()
//   // })
//   // test('User should NOT receive pro-rated manna when downgrading subscription', async context => {
//   //   // @ts-ignore
//   //   const { server } = context
//   //   expect(typeof server).eq('xxx')
//   //   await server.close()
//   // })
//   // test('User should be reset to free tier when their subscription expires', async context => {
//   //   // @ts-ignore
//   //   const { server } = context
//   //   expect(typeof server).eq('xxx')
//   //   await server.close()
//   // })
// })
import { describe, expect, test } from 'vitest'

describe('Payments', () => {
  test('Should return server instance', async context => {
    // @ts-ignore
    const { server } = context
    expect(typeof server).eq('object')
    await server.close()
  })
})
