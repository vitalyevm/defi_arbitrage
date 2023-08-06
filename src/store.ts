import {Chain, PoolInfo, PoolInfoDb, PrimedPoolFile, Reserves, TokenInfo} from "./index";
import {
    allowed, disallowed,
    EXCHANGES,
    IERC20_ABI,
    PANCAKE_ROUTER_ADDRESS_V2,
    PANCAKE_ROUTER_ADDRESS_V1,
    ROUTERS,
    WBNB, web3, BSC_CHAIN_ID, REINDEX_DB, ROUTER_LIST, PANCAKE_ROUTER_ADDRESS_V3,
} from "./constants";
import cliProgress from "cli-progress";
import sha1 from "sha1";
import {BigNumber} from "bignumber.js";

import {PancakePair} from "../typechain/PancakePair";
import {PancakeERC20} from "../typechain/PancakeERC20";
import {Database} from "../prisma/lib/Database"
import {PoolVersion} from "../prisma/lib/prisma"
import farms from "../data/farm_pools";

import colors from "colors";
import {BlockType} from "../typechain/types";
import { getFactoryPair, getPair, getPairNatively, getReserves } from "./contract";
import { getFee, isLowerCaseEthereumAddress } from "./utils";

export const tokenInfo: {
    [tokenAddress: string]: TokenInfo
} = {};
// pool hash of sha512((token0,token1).sort()+router_address)
export const poolInfoMap: {
    [poolHash: string]: PoolInfo
} = {}
export const poolIndexByToken: {
    [tokenAddress: string]: { [oppositeToken: string]: {[poolAddress: string]: PoolInfo} }
} = {}
export const poolIndexByAddress: {
    [poolAddress: string]: PoolInfo
} = {}
export const bnbPoolIndex: {
    [tokenAddress: string]: PoolInfo
} = {}
export const triangularIndex: {
    [pool: string]:  Chain[]
} = {}
export var nextBlockEst = -1;

export let blockType: BlockType = 'latest';

export function setBlockType(type: BlockType) {
    blockType = type;
}

export function setNextBlockEst(time: number){
    nextBlockEst = time;
}

function buildTriIndex(pool: PoolInfo) {
    // create an index for triangular chains
    // triangularIndex[pool.hashCode] = getChains(pool)
}

function indexPool(pool: PoolInfo) {
    poolInfoMap[pool.hashCode] = pool

    if (disallowed.has(pool.token0) || disallowed.has(pool.token1)) {
        poolInfoMap[pool.hashCode] = {valid: false} as PoolInfo
        poolInfoMap[pool.hashCode] = {valid: false} as PoolInfo
        return;
    }

    if (!poolIndexByToken[pool.token0]) {
        poolIndexByToken[pool.token0] = {}
    }
    if (!poolIndexByToken[pool.token1]) {
        poolIndexByToken[pool.token1] = {}
    }

    if (!poolIndexByToken[pool.token0][pool.token1]) {
        poolIndexByToken[pool.token0][pool.token1] = {}
    }
    if (!poolIndexByToken[pool.token1][pool.token0]) {
        poolIndexByToken[pool.token1][pool.token0] = {}
    }
    // add to index
    if (!poolIndexByToken[pool.token0][pool.token1][pool.address]) {
        poolIndexByToken[pool.token0][pool.token1][pool.address] = pool
    }
    if (!poolIndexByToken[pool.token1][pool.token0][pool.address]) {
        poolIndexByToken[pool.token1][pool.token0][pool.address] = pool
    }

    poolIndexByAddress[pool.address] = pool

    // create WBNB index of token.address -> WBNB pool
    if (pool.token0 === WBNB) {
        bnbPoolIndex[pool.token1] = pool
    } else if (pool.token1 === WBNB) {
        bnbPoolIndex[pool.token0] = pool
    }
}

export async function loadPools() {
    const tokens = await Database.getTokens();
    const pools = await Database.getPools();
    
    const loadPairsBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    loadPairsBar.start(farms.length, 0)

    for (const farmPool of farms) {
        const routerV1 = PANCAKE_ROUTER_ADDRESS_V1;
        const checkDbV1 = pools.find(pool => pool && pool.address === farmPool.toLocaleLowerCase());
        const dbPoolV1 = checkDbV1 && !REINDEX_DB ? checkDbV1 : null;
        const check = await validatePool(farmPool, routerV1, dbPoolV1);

        loadPairsBar.increment();
        if (!check) continue;

        const {token0, token1} = check;

        const routerV2 = PANCAKE_ROUTER_ADDRESS_V2;
        const poolV2 = getPairNatively(token0.toLowerCase(), WBNB, false);
        const checkDbV2 = pools.find(pool => pool && pool.address === poolV2.toLocaleLowerCase());
        const dbPoolV2 = checkDbV2 && !REINDEX_DB ? checkDbV2 : null;
        
        await validatePool(poolV2, routerV2, dbPoolV2);
    }

    for (const token of tokens) {
        if (token.symbol.toLowerCase() === 'WBNB'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'USDC'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'USDT'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'BUSD'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'ADA'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'MATIC'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'DOT'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'BTCB'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'ETH'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'DAI'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'TRX'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'AVAX'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'TONCOIN'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'ATOM'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'UNI'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'LINK'.toLowerCase()) continue;
        if (token.symbol.toLowerCase() === 'ETC'.toLowerCase()) continue;

        if (disallowed.has(token.address.toLowerCase())) continue;

        const findedPools = [];
        
        for (const [router, factory] of Object.entries(ROUTERS)) {
            if (router === PANCAKE_ROUTER_ADDRESS_V3) continue; // critical point, because pancake v3 its v2 pools

            const pool = await getFactoryPair(factory, token.address);
            if (!pool) continue;
            
            const checkDb = pools.find(dbPool => dbPool && dbPool.address === pool.toLocaleLowerCase());
            const dbPool = checkDb && !REINDEX_DB ? checkDb : null;
            const poolInfo = await validatePool(pool, router, dbPool);
            if (!poolInfo) continue;

            findedPools.push(poolInfo);
        }
        
        if (findedPools.length === 0 || findedPools.length === 1) continue;

        findedPools.sort((a, b) => {
            if (a.reserve1.isGreaterThan(b.reserve1)) {
              return 1;
            } else if (a.reserve1.isLessThan(b.reserve1)) {
              return -1;
            } else {
              return 0;
            }
        });

        for (const findedPool of findedPools) {
            indexPool(findedPool);
            if (REINDEX_DB) {
                await Database.savePool(findedPool);
            }
        }
        loadPairsBar.increment();
    }

    console.log(colors.bgGreen('finish loading'));
    loadPairsBar.stop();
}

export async function validatePool(poolAddress: string, routerAddress: string, dbPool: PoolInfoDb | null): Promise<void | PoolInfo> {
    let contract: PancakePair;
    let reserves: Reserves;
    let token0: string;
    let token1: string;

    if (dbPool) {
        contract = getPair(poolAddress);
        reserves = {reserve0: dbPool.reserve0, reserve1: dbPool.reserve1};
        token0 = dbPool.token0.address.toLowerCase();
        token1 = dbPool.token1.address.toLowerCase();
    } else if (REINDEX_DB) {
        const data = await getReserves(poolAddress, blockType);
        if (!data) return;

        contract = data.contract;
        reserves = data.reserves;
        token0 = (await contract.methods.token0().call()).toLowerCase();
        token1 = (await contract.methods.token1().call()).toLowerCase();
    } else {
        return;
    }

    if (token1 !== WBNB) return;

    const bnbReserves = token1 === WBNB ? new BigNumber(reserves.reserve1) : new BigNumber(reserves.reserve0);
    const etherValue = web3.utils.toWei('1', 'ether');
    if (bnbReserves.lt(new BigNumber(etherValue))) {
        return;
    }

    await set2TokenInfo(token0, token1, dbPool);

    const poolInfo: PoolInfo = {
        hashCode: sha1([token0.toLowerCase(), token1.toLowerCase()].sort() + routerAddress.toLowerCase()) as string,
        valid: true,
        contract: contract,
        version: routerAddress === PANCAKE_ROUTER_ADDRESS_V1 ? PoolVersion.V1 : PoolVersion.V2,
        address: contract.options.address.toLowerCase(),
        reserve0: reserves.reserve0,
        reserve1: reserves.reserve1,
        token0: token0,
        token1: token1,
        fee: getFee(routerAddress),
        exchange: EXCHANGES[routerAddress] || ''
    };

    return poolInfo;
}

async function set2TokenInfo(inputToken: string, outputToken: string, dbData: PoolInfoDb | null) {
    if (!isLowerCaseEthereumAddress(outputToken) || !isLowerCaseEthereumAddress(inputToken)) {
        console.log(colors.bgRed(`Input or output address is not lowercase: ${inputToken} ${outputToken}`))
        return;
    }
    await fillTokenInfo(outputToken, dbData);
    await fillTokenInfo(inputToken, dbData);
}

async function fillTokenInfo(tokenAddress: string, dbData: PoolInfoDb | null): Promise<TokenInfo | undefined> {
    let tokenData = tokenInfo[tokenAddress];
  
    if (!tokenData) {
        if (dbData && (dbData.token0.address === tokenAddress || dbData.token1.address === tokenAddress)) {
            tokenData = dbData.token0.address === tokenAddress ? dbData.token0 : dbData.token1;
        } else {
            const tokenContract = new web3.eth.Contract(IERC20_ABI.abi, tokenAddress) as any as PancakeERC20;
            const decimals = await tokenContract.methods.decimals().call();
    
            tokenData = {
                id: tokenAddress.toLowerCase(),
                symbol: await tokenContract.methods.symbol().call(),
                name: await tokenContract.methods.name().call(),
                address: tokenAddress.toLowerCase(),
                chainId: BSC_CHAIN_ID,
                decimals
            };
        }
    }
  
    tokenInfo[tokenAddress] = tokenData;

    if (!dbData) await Database.saveToken(tokenData);

    return tokenData;
}

export function checkTokensInStorage(tokens: string[]) {   
    const filteredTokens = tokens.filter((token) => {
        return token.toLowerCase() !== WBNB;
    });
      
    const hasTokenInfo = filteredTokens.some((token) => {
        return !!poolIndexByToken[token.toLowerCase()];
    });
    if (!hasTokenInfo) return;
    
    const getToken = filteredTokens.find((token) => {
        // console.log('gettoken', !!poolIndexByToken[token.toLowerCase()], poolIndexByToken[token.toLowerCase()]);
        return !!poolIndexByToken[token.toLowerCase()];
    });
    return getToken;
}

export function getPools(pool: PoolInfo): Chain | null {
    const token0 = pool.token0;
    const token1 = pool.token1;

    if (poolIndexByToken[token0] && poolIndexByToken[token0][token1]) { // critical point
        const rawPools = poolIndexByToken[token0][token1];

        const sortedPools = Object.values(rawPools).sort((a, b) => {
            if (a.reserve1.isGreaterThan(b.reserve1)) {
              return 1;
            } else if (a.reserve1.isLessThan(b.reserve1)) {
              return -1;
            } else {
              return 0;
            }
        });

        const poolsAddress = sortedPools.map(pool => pool.address).filter(filteredPool => pool.address !== filteredPool);

        if (!poolsAddress || !poolsAddress.length) {
            console.log(colors.red(`recheck this pools: ${poolsAddress}. tokens: ${[token0, token1]}`));
            return null;
        }
        if (sortedPools[0].token0 !== token0 && sortedPools[0].token1 !== token1) {
            console.log(colors.red(`recheck this pools tokens not equal: ${poolsAddress}. tokens: ${[token0, token1]}`));
            return null;
        }
        
        const data = {
            tokens: [token0, token1],
            mainPool: pool.address,
            extraPools: poolsAddress
        }
        return data;
    }

    return null;
}
