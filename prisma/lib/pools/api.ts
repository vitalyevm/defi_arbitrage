import { BigNumber } from 'bignumber.js';
// eslint-disable-next-line
import type * as _ from '@prisma/client/runtime'

import client from '../prisma'

import { PoolType, PoolVersion } from '../enums'
import { PoolInfo, PoolInfoDb } from '../../../src'
import { EXCHANGES, PANCAKE_ROUTER_ADDRESS_V1, PANCAKE_ROUTER_ADDRESS_V2 } from '../../../src/constants'
import sha1 from 'sha1'
import { getPair } from '../../../src/contract';

type PartialWithUndefined<T extends object> = Partial<{
  [K in keyof T]: T[K] | undefined
}>

export type PoolApiArgs = PartialWithUndefined<{
  chainIds: number[]
  poolTypes: PoolType[]
  isIncentivized: boolean
  isWhitelisted: boolean
  cursor: string
  orderBy: string
  orderDir: 'asc' | 'desc'
  count: boolean
}>

export async function getPool(address: string, chainId?: number): Promise<PoolInfoDb | null> {
  // const id = `${chainId}:${address.toLowerCase()}`
  const id = address.toLowerCase()
  const poolData = await client.pool.findFirst({
    include: {
      token0: true,
      token1: true,
    },
    where: {
      id,
    },
  })
  await client.$disconnect()

  if (!poolData) return null;

  const router = poolData.version ===  PoolVersion.V1 ? PANCAKE_ROUTER_ADDRESS_V1 : PANCAKE_ROUTER_ADDRESS_V2;
  const pool_contract = getPair(poolData.address);
  
  const pool = {
    ...poolData,
    hashCode: sha1([poolData.token0.address, poolData.token1.address].sort() + router) as string,
    valid: true,
    token0: poolData.token0,
    token1: poolData.token1,
    exchange: EXCHANGES[router] || '',
    contract: pool_contract,
    reserve0: new BigNumber(poolData.reserve0),
    reserve1: new BigNumber(poolData.reserve1)
  }
  return pool;
}

type PrismaArgs = NonNullable<Parameters<typeof client.pool.findMany>['0']>

function parseWhere(args: PoolApiArgs) {
  let where: PrismaArgs['where'] = {}

  if (args.chainIds) {
    where = {
      chainId: { in: args.chainIds },
    }
  }

  if (args.poolTypes) {
    where = {
      type: { in: args.poolTypes },
      ...where,
    }
  }

  if (args.isWhitelisted) {
    where = {
      token0: {
        status: 'APPROVED',
      },
      token1: {
        status: 'APPROVED',
      },
      ...where,
    }
  }

  return where
}

export async function getPools(): Promise<PoolInfoDb[] | []> {
  const rawPools = await client.pool.findMany({
    include: {
      token0: true,
      token1: true,
    }
  })

  const pools = [];
  for (const rawPool of rawPools) {
    const router = rawPool.version ===  PoolVersion.V1 ? PANCAKE_ROUTER_ADDRESS_V1 : PANCAKE_ROUTER_ADDRESS_V2;
    const pool_contract = getPair(rawPool.address);

    const pool = {
      ...rawPool,
      hashCode: sha1([rawPool.token0.address, rawPool.token1.address].sort() + router) as string,
      valid: true,
      token0: rawPool.token0,
      token1: rawPool.token1,
      exchange: EXCHANGES[router] || '',
      contract: pool_contract,
      reserve0: new BigNumber(rawPool.reserve0),
      reserve1: new BigNumber(rawPool.reserve1)
    }
    pools.push(pool);
  }

  await client.$disconnect()
  return pools ? pools : []
}

export async function getAllPools(args: PoolApiArgs) {
  const orderBy: PrismaArgs['orderBy'] = args.orderBy ? { [args.orderBy]: args.orderDir } : { ['liquidityUSD']: 'desc' }
  const where: PrismaArgs['where'] = parseWhere(args)

  let skip: PrismaArgs['skip'] = 0
  let cursor: { cursor: PrismaArgs['cursor'] } | object = {}

  if (args.cursor) {
    skip = 1
    cursor = { cursor: { id: args.cursor } }
  }

  const pools = await client.pool.findMany({
    take: 20,
    skip,
    ...cursor,
    where,
    orderBy,
    select: {
      id: true,
      address: true,
      name: true,
      chainId: true,
      version: true,
      type: true,
      fee: true,
      liquidityUSD: true,
      token0: {
        select: {
          id: true,
          address: true,
          name: true,
          symbol: true,
          decimals: true,
        },
      },
      token1: {
        select: {
          id: true,
          address: true,
          name: true,
          symbol: true,
          decimals: true,
        },
      },
    },
  })

  await client.$disconnect()
  return pools ? pools : []
}

export async function getPoolCount(args: PoolApiArgs) {
  const where: PrismaArgs['where'] = parseWhere(args)

  const count = await client.pool.count({
    where,
  })

  await client.$disconnect()
  return count ? count : null
}
