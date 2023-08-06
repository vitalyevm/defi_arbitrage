import 'dotenv/config'

import {PoolApiArgs, getPool as getDbPool, getPools as getDbPools, getPoolCount as getDbPoolCount} from './pools/api'
import {getTokens as getDbTokens, getToken as getDbToken} from './tokens/api'
import {createPools, createPool} from './pools/load'
import {createToken, createTokens} from './tokens/load'
import { PoolInfo, TokenInfo } from '../../src'

export class Database {
    public static getPool(address: string) {
        return getDbPool(address)
    }

    public static getPools() {
        return getDbPools()
    }

    public static getDbPoolCount(args: PoolApiArgs) {
        return getDbPoolCount(args)
    }

    public static savePools(poolsInfo: PoolInfo[]) {
        return createPools(poolsInfo)
    }

    public static savePool(poolInfo: PoolInfo) {
        return createPool(poolInfo)
    }

    public static getToken(address: string) {
        return getDbToken(address)
    }

    public static getTokens() {
        return getDbTokens()
    }

    public static getDbTokenCount(args: PoolApiArgs) {
        return getDbPoolCount(args)
    }

    public static saveTokens(tokenInfo: TokenInfo[]) {
        return createTokens(tokenInfo)
    }

    public static saveToken(tokenInfo: TokenInfo) {
        return createToken(tokenInfo)
    }

}