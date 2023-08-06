import { PoolInfo } from '../../../src';
import { BSC_CHAIN_ID } from '../../../src/constants';
import { PoolVersion } from '../enums'
import client, { Prisma, PrismaClient } from '../prisma'
import { performance } from 'perf_hooks'

// export async function createPools(pools: Prisma.PoolCreateManyInput[]) {
export async function createPools(poolsInfo: PoolInfo[]) {
  // const {token0, token1, version, fee, address} = poolInfo;
  
  // const data = {
  //     fee,
  //     address,
  //     version,
  //     id: address.toLowerCase(),
  //     chainId: BSC_CHAIN_ID,
  //     reserve0: poolInfo.reserve0.toString(),
  //     reserve1: poolInfo.reserve1.toString(),
  //     token0Id: token0,
  //     token1Id: token1,
  // }

  // Prisma.validator<Prisma.PoolCreateManyInput>()(data);

  // const pools = data;
  // const startTime = performance.now()
  // const created = await client.pool.createMany({
  //   data: pools,
  //   skipDuplicates: true,
  // })

  // const endTime = performance.now()
  // const duration = ((endTime - startTime) / 1000).toFixed(1)
  // if (created.count > 0) {
  //   console.log(`LOAD - Created ${created.count} pools. (${duration}s) `)
  // } else {
  //   console.log(`LOAD - No pools created, already exist. (${duration}s) `)
  // }
}

export async function createPool(poolInfo: PoolInfo) {
  const {token0, token1, version, fee, address} = poolInfo;
  
  const data = {
      fee,
      address,
      version,
      id: address.toLowerCase(),
      chainId: BSC_CHAIN_ID,
      reserve0: poolInfo.reserve0.toString(),
      reserve1: poolInfo.reserve1.toString(),
      token0Id: token0,
      token1Id: token1,
  }

  Prisma.validator<Prisma.PoolCreateManyInput>()(data);

  const startTime = performance.now()
  // const created = await client.pool.create({
  //   data,
  // })
  const created = await client.pool.createMany({
    data: [data],
    skipDuplicates: true,
  })

  const endTime = performance.now()
  const duration = ((endTime - startTime) / 1000).toFixed(1)
  if (created.count) {
    console.log(`LOAD - Created 1 pool. ${poolInfo.address} (${duration}s) `)
  } else {
    console.log(`LOAD - No pools created, already exist. (${duration}s) `)
  }
}

export async function getLatestPoolTimestamp(chainId: number, versions: PoolVersion[]) {
  const startTime = performance.now()
  const latestPool = await client.pool.findFirst({
    select: {
      address: true,
      generatedAt: true,
    },
    where: {
      version: {
        in: versions,
      },
      chainId,
    },
    orderBy: {
      generatedAt: 'desc',
    },
  })
  const endTime = performance.now()
  const duration = ((endTime - startTime) / 1000).toFixed(1)
  if (!latestPool) {
    return null
  }
  const latestPoolTimestamp = (latestPool.generatedAt.getTime() / 1000).toFixed()
  console.log(`\nLatest pool ${latestPool.address}, creation timestamp: ${latestPoolTimestamp} (${duration}s)`)
  return latestPoolTimestamp
}
