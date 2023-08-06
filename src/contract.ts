import Web3 from "web3";
import {ethers, utils} from "ethers";
import {pack, keccak256} from '@ethersproject/solidity';
import {BigNumber} from "bignumber.js"
import {
    ultimaBalancer,
    // flashbotBalancer,
    web3,
    UNISWAP_PAIR,
    PANCAKE_FACTORY_ADDRESS_V2,
    FACTORY_V2_INIT_CODE_HASH,
    PANCAKE_FACTORY_ADDRESS_V1,
    FACTORY_V1_INIT_CODE_HASH,
    wsUltimaBalancer,
    ULTIMA_BALANCER_ADDRESS,
    web3Ws,
    WBNB,
    PANCAKE_FACTORY
} from "./constants";
import {Chain, PoolInfo, Reserves} from "./index";

import deployer from "../.secret";
import {blockType} from './store';
import {PancakePair} from "../typechain/PancakePair";
import {BlockType} from "../typechain/types";
import redis from "../prisma/lib/redis";
import { PancakeFactory } from "../typechain/PancakeFactory";
import { delay } from "@nomiclabs/hardhat-etherscan/dist/src/etherscan/EtherscanService";

const colors = require('colors');

let isRunning = false;
let bannedHashes: string[] = [];

export const processRedisQueue = async () => {
    const items = await redis.hgetall("transaction_queue");
    
    for (const [hash, item] of Object.entries(items)) {
        if (isRunning) continue;

        const queueItem = JSON.parse(item);
        const currentTime = Date.now();

        if (currentTime - queueItem.timestamp > 3000) {
            await redis.hdel("transaction_queue", hash);
            continue;
        }

        if (queueItem.failCount >= 2) {
            bannedHashes.push(hash);
            await redis.hdel("transaction_queue", hash);
            continue;
        }

        try {
            isRunning = true;
            await executeTransaction(queueItem.data);
            
            await redis.hdel("transaction_queue", hash);
            isRunning = false;
        } catch (error) {
            isRunning = false;
            console.error("Transaction failed:", error);

            queueItem.failCount += 1;
            await redis.hset("transaction_queue", hash, JSON.stringify(queueItem));
        }
    }
};
  
export async function prepareTransaction(chain: Chain, gas: number) {
    
    let promises = [];
    for (const pool of chain.extraPools) {
        try {
            const calldata = {
                pool0: chain.mainPool,
                pool1: pool,
                baseToken: chain.tokens[0],
            }

            const defaultSwapCost = 152000;
            const cleanMath = (gas - defaultSwapCost) / 700;
            const count = defaultSwapCost < gas ? Math.floor(cleanMath + cleanMath * 0.15) : 0;
    
            const data: [string, string, string, number] = [calldata.pool0, calldata.pool1, WBNB, 0];

            promises.push()
            const result = await ultimaBalancer.methods.getProfit(data).call();
            console.log(colors.blue(`Profit on ${data[0]} & ${data[1]}: ${ethers.utils.formatEther(result)}; wei ${result}`));

            if (ethers.BigNumber.from(result).lt(utils.parseEther("0.0025").toString())
                || ethers.BigNumber.from(result).gt(utils.parseEther("1").toString())
            ) {
                continue;
            };
            // await ultimaBalancer.methods.executes(data).call();
    
            await delay(3000);
            await executeTransaction(data);
            return;
        } catch (e) {
            console.log(colors.red(`Error during get profit call`));
            console.log(e);
            // getContractBalance();
            continue;
        }
    }

    return;
}

const executeTransaction = async (data: [string, string, string, number]) => {
    console.log(`Sending transaction at: ${Date.now()}`, data);
    const txData = wsUltimaBalancer.methods.executes(data).encodeABI();

    const gasPrice = web3.utils.toWei("3", "gwei");
    const gasLimit = 152000 + data[3] * 1000;

    const tx = {
        from: deployer.address,
        to: ULTIMA_BALANCER_ADDRESS,
        data: txData,
        gas: gasLimit,
        gasPrice: gasPrice,
    };

    const signedTx = await web3Ws.eth.accounts.signTransaction(tx, deployer.private);
    const receipt = await web3Ws.eth.sendSignedTransaction(signedTx.rawTransaction as string);

    console.log("Transaction Receipt:", receipt);

    return receipt;
};


const simulateTransaction = async (sandwichContract: any, amountIn: any, amoutOutMin: any, path: any, txOptions: any) => {
    try {
        await sandwichContract.methods.swap(amountIn, amoutOutMin, path).call(txOptions)
        const gasEstimate = sandwichContract.methods.swap(amountIn, amoutOutMin, path).estimateGas(txOptions)
        return gasEstimate
    } catch (e) {
        console.log('Simulation failed.', e)    
    }
}

export async function getReserves(address: string, blockType: BlockType): Promise<{contract: PancakePair, reserves: Reserves} | null> {
    try {
        const contract = getPair(address);
        const rawReserves = await contract.methods.getReserves().call(undefined, blockType); // TODO check Cake - no getReserves function
        const reserves = {
            reserve0: new BigNumber(rawReserves[0]),
            reserve1: new BigNumber(rawReserves[1]),
        }
        return {contract, reserves};
    } catch (err) {
        return null;
    }
}


export function getPair(pool_address: string): PancakePair {    
    return (new web3.eth.Contract(UNISWAP_PAIR.abi, pool_address) as any) as PancakePair;
}

export function getPairNatively(token0: string, token1: string, isV1: boolean) {
    const pair = ethers.utils.getCreate2Address(
        isV1 ? PANCAKE_FACTORY_ADDRESS_V1: PANCAKE_FACTORY_ADDRESS_V2,
        keccak256(['bytes'], [pack(['address', 'address'], [token0, token1].sort())]),
        isV1 ? FACTORY_V1_INIT_CODE_HASH : FACTORY_V2_INIT_CODE_HASH
    )
    return pair
}

export async function getFactoryPair(factory: PancakeFactory, token: string) {
    const pool_address = await factory.methods.getPair(token, WBNB).call();
    if (pool_address == '0x0000000000000000000000000000000000000000') {
        return;
    }
    return pool_address;
}

// update a pool with the latest actual block prices
export async function updatePool(pool: PoolInfo) {
    const reserves = await (pool as PoolInfo).contract.methods.getReserves().call(undefined, blockType);
    pool.reserve0 = new BigNumber(reserves._reserve0);
    pool.reserve1 = new BigNumber(reserves._reserve1);
}

