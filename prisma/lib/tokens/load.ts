import { TokenInfo } from '../../../src'
import client, { Prisma,PrismaClient } from '../prisma'
import { performance } from 'perf_hooks'

export async function createTokens(tokenInfo: TokenInfo[]) {
  // const tokens = [{...tokenInfo, decimals: tokenInfo.decimals.toString()}]
  // if (tokens.length === 0) {
  //   return
  // }
  // const startTime = performance.now()
  // const created = await client.token.createMany({
  //   data: tokens,
  //   skipDuplicates: true,
  // })

  // const endTime = performance.now()
  // const duration = ((endTime - startTime) / 1000).toFixed(1)
  // if (created.count > 0) {
  //   console.log(`LOAD - Created ${created.count} tokens. (${duration}s) `)
  // } else {
  //   console.log(`LOAD - No tokens created, already exist. (${duration}s) `)
  // }
}

export async function createToken(tokenInfo: TokenInfo) {
  const startTime = performance.now()
  const created = await client.token.createMany({
      data: [tokenInfo],
      skipDuplicates: true,
    })

  const endTime = performance.now()
  const duration = ((endTime - startTime) / 1000).toFixed(1)
  if (created.count > 0) {
    console.log(`\nLOAD - Created ${tokenInfo.address} token. (${duration}s) `)
  } else {
    console.log(`\nLOAD - No tokens created, already exist. (${duration}s) `)
  }
}
