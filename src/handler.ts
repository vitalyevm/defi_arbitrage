import {Transaction} from "web3-core";
import {Chain, PoolsToUpdate} from "./index";
import {
    IERC20_ABI,
    PANCAKE_ROUTER_ADDRESS_V2,
    PANCAKE_ROUTER_ADDRESS_V3,
    ROUTERS,
    ROUTER_LIST, ROUTER_SWAP_METHODS,
    ROUTER_SWAP_METHODS_B_TO_A,
    ULTIMA_BALANCER_ADDRESS,
    WBNB,
    ultimaBalancer,
    web3,
} from "./constants";

const colors = require('colors');
import sha1 from "sha1";


import {checkTokensInStorage, getPools, poolIndexByToken, poolInfoMap} from "./store";
import { decode } from "./utils";
import { prepareTransaction, processRedisQueue } from "./contract";
import BigNumber from "bignumber.js";
import { PancakeERC20 } from "../typechain/PancakeERC20";
import { utils, BigNumber as BigNumberEther } from "ethers";
import { inputFile } from "hardhat/internal/core/params/argumentTypes";


export async function handleNewBlock(blockNumber: number, poolsToUpdate: PoolsToUpdate) {
    const block = await web3.eth.getBlock(blockNumber, true)
    if (!block || !block.transactions) return;
    // const poolsToUpdate = new Map<string, { in_token: string, out_token: string, router: string, amountIn: any, amountOut: any, aToB: boolean }>();

    for (const token0 in poolIndexByToken) {
        for (const token1 in poolIndexByToken[token0]) {
            const pools = poolIndexByToken[token0][token1];
            const router = PANCAKE_ROUTER_ADDRESS_V2;
            const poolId = sha1([token0.toLowerCase(), token1.toLowerCase()].sort() + router) as string

            poolsToUpdate.set(poolId, {
                in_token: token1.toLowerCase(),
                out_token: token0.toLowerCase(),
                router: router,
                gas: 1
            })
        }
    }
    
    console.log(`blockTime: ${block.timestamp}, currentTime: ${new Date().getTime()}`)
    handleBlock(poolsToUpdate, blockNumber)
    
    processRedisQueue();
}

let balance: BigNumber;

export async function handleTransaction(transaction: Transaction, router: string, poolsToUpdate: PoolsToUpdate) {
    const start = Date.now();
    const isV3Router = router === PANCAKE_ROUTER_ADDRESS_V3 ? true : false;
    const input = transaction.input;
    const inputData = decode(input, isV3Router);
    if (!inputData) return;
    
    let path;
    let amountIn;
    let amountOut;
    let amountOutMin;
    
    if (ROUTER_SWAP_METHODS.includes(inputData.name)) {
        path = inputData.params.find(param => param.name === 'path')?.value as string[] | null
        amountIn = inputData.params.find(param => param.name === 'amountIn')?.value as string | null
        amountOut = inputData.params.find(param => param.name === 'amountOut')?.value as string | null
        amountOutMin = inputData.params.find(param => param.name === 'amountOutMin')?.value as string | null
    }
    
    console.log(colors.green(`find: \t ${transaction.hash}, path ${path}, amountOut ${amountOut}, amountOutMin ${amountOutMin}`))
    if (path) {
        if (!amountOut && !amountOutMin) return;

        const lowerArray = path.map(item => item.toLowerCase());
        const existToken = checkTokensInStorage(lowerArray); // critical point
        
        if (!lowerArray.includes(WBNB) || !existToken) return;
        console.log(colors.green(`find: \t ${existToken}, tx: ${transaction.hash}, path: ${lowerArray}`))
        
        // const aToB = ROUTER_SWAP_METHODS_B_TO_A.includes(inputData.name) && lowerArray[0] === WBNB ? false : !!amountIn;
        const aToB = ROUTER_SWAP_METHODS_B_TO_A.includes(inputData.name) ? false : !!amountIn;
        const rawAmountOut = amountOutMin ? amountOutMin : amountOut;
        const rawAmountIn = amountIn ? amountIn : transaction.value;

        if (!aToB && rawAmountIn) {
            if (new BigNumber(rawAmountIn).lt(utils.parseEther('0.06').toString())) {
                console.log(colors.red(`balance not enought for transaction \t victim amount in - ${rawAmountIn}; balance - ${balance}`))
                return;
            }
        }
        if (aToB && rawAmountOut) {
            if (new BigNumber(rawAmountOut).lt(utils.parseEther('0.06').toString())) {
                console.log('del recheck', aToB, ROUTER_SWAP_METHODS_B_TO_A.includes(inputData.name), inputData.params);
                console.log(colors.red(`balance not enought for transaction \t victim amount out - ${rawAmountOut}; balance - ${balance}`))
                return;
            }
        }

        // change v3 router to v2
        const recheckedRouter = isV3Router ? PANCAKE_ROUTER_ADDRESS_V2 : router; // critical point

        const poolId = sha1([existToken.toLowerCase(), WBNB].sort() + recheckedRouter.toLowerCase()) as string; // critical point, if pool not found that mean that router is not exist in this pair
        const pool = poolInfoMap[poolId];
        
        if (!pool) {
            console.log(colors.red(`pool not found`))
            return;
        };
        
        const updatedPools = Date.now();
        const chain = getPools(pool);
        if (!chain) {
            console.log(colors.red(`chain not found`))
            return;
        };
        
        const gas = transaction.gas;
        await prepareTransaction(chain, gas);

        const end = Date.now();
        console.log(colors.blue([
            `block:  \t ${transaction.blockNumber}, currentTime: ${new Date().getTime()}, tx: ${transaction.hash}`,
            `looking:\t ${end - updatedPools}ms`,   
            `total:  \t ${end - start}ms`,
        ].join('\n')))
    }
}

export async function handleBlock(poolsToUpdate: PoolsToUpdate, blockNumber: number | string) {
    const chains: Chain[] = [];
    const start = Date.now();
    let count = 0
    for (let [key, value] of poolsToUpdate) { // ловим те транзы которые нужны, и смотрим есть ли нужные токены для свапа в map
        const pool = poolInfoMap[key];
        if (!pool) {
            continue;
        }
    }

    if (poolsToUpdate.size === 0) return;

    const set = Date.now();
    // our pools were updated, look for an arb opp in the tokens that were updated

    /**
     * 1. for the updated pools look at other token chains and run a triangular arb play
    */
   // O(N) -- loop per pair in this block
   for (let key of poolsToUpdate.keys()) {
        const pool = poolInfoMap[key];
        const gas = poolsToUpdate.get(key)?.gas;
        if (!pool || !pool.valid || !gas) continue;
        
        // chains.push(...getPools(key, pool, gas))
    }
        
    const foundChains = Date.now();
    const updatedPools = Date.now();
    const promises = [];
    for (let chain of chains) {
        // promises.push(prepareTransaction(chain))
    }
    // await Promise.all(promises);
    const end = Date.now();
    console.log(colors.blue([
        `block: ${blockNumber}`,
        `newPools:     ${count}  time ${set - start}ms`,
        `foundChains:  ${chains.length}  time ${foundChains - set}ms,   total: ${foundChains - start}ms`,
        `looking:         time ${end - updatedPools}ms,   total: ${end - start}ms`,
    ].join('\n')))
}

export async function getContractBalance() {
    const tokenContract = (new web3.eth.Contract(IERC20_ABI.abi, WBNB) as any) as PancakeERC20;
    const rawBalance = await tokenContract.methods.balanceOf(ULTIMA_BALANCER_ADDRESS).call();
    balance = new BigNumber(rawBalance);
    console.log(colors.green(`token balance: ${balance}`))
}

export async function handlePendingTransaction(txHash: string) {
    const transaction = await web3.eth.getTransaction(txHash);

    if (transaction && transaction.to && ROUTER_LIST.includes(transaction.to.toLowerCase())) {
        const poolsToUpdate = new Map<string, { in_token: string, out_token: string, router: string, amountIn: any, amountOut: any, aToB: boolean, gas: number }>();
        // Ловим транзакции и чекаем идут ли они через роутер панкейка
        // если находим такую транзакцию - добавляем ее в объект выше 
        await handleTransaction(transaction as Transaction, transaction.to.toLowerCase(), poolsToUpdate)
        // // Если есть match между poolsToUpdate и poolInfoMap, то переходим к поиску пулов с этими токенами
        // await handleNewBlock(poolsToUpdate, transaction.hash || 0)
        // await handleBlock(poolsToUpdate, transaction.hash || 0)
    }
}

