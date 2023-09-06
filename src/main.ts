import * as dotenv from "dotenv";
// dotenv.config({path: `.env.development`});
console.log('env:', process.env.NODE_ENV, process.env.NODE_ENV === 'prod');
dotenv.config({path: process.env.NODE_ENV === 'prod' ? `.env.prod` : `.env.development`});

const args = process.argv.slice(2);
import { 
  web3Ws
} from "./constants";
import {
  nextBlockEst,
  loadPools,
  setBlockType,
  setNextBlockEst,
} from "./store";
import {
  handleBlock,
  handleNewBlock,
  handlePendingTransaction,
  getContractBalance,
} from "./handler";
import {delay} from "@nomiclabs/hardhat-etherscan/dist/src/etherscan/EtherscanService";
import colors from "colors";
import { BigNumber } from "bignumber.js";

export async function currentBlockStrategy() {
  // fetch all pairs to seed our pool
  await loadPools();

  const processQueueInCycle = async () => {
    while (true) {
      try {
        // await processRedisQueue();
      } catch (error) {
        console.error("Error while processing the Redis queue:", error);
      }
  
      await delay(3000);
    }
  };
  processQueueInCycle();

  /**
   * 1. Listen to transaction in the mempool
   * 2. Calculate the amounts (including fees and gas) for each exchange
   * 3. If discrepancies, check for profits.
   *
   */

  const sub = web3Ws.eth.subscribe("newBlockHeaders", (err, result) => {});
  sub.on("data", async (data) => {
    const blockNumber = data.number;
    console.log(`new block: ${data.number} at ${Date.now()}`);
    const poolsToUpdate = new Map<string, { in_token: string, out_token: string, router: string, amountIn: any, amountOut: any, aToB: boolean, gas: number }>();
    handleNewBlock(blockNumber, poolsToUpdate);
  });
  
  sub.on("error", async (err) => {
    console.error(err);
  });
}

export async function memPoolStrategy() {
  setBlockType("pending");
  await loadPools();
  await getContractBalance();

  console.log(colors.bgBlue('start scan'));
  
  const sub = web3Ws.eth.subscribe("pendingTransactions", (err, result) => {});
  sub.on("data", async (data) => {
    try {
      handlePendingTransaction(data);
    } catch (e) {
      console.log(e)
    }
  });
  sub.on("error", async (err) => {
    console.error(err);
  });
}

export async function everySecond() {
  setBlockType("pending");
  // fetch all pairs to seed our pool
  await loadPools();
  const sub = web3Ws.eth.subscribe("newBlockHeaders", (err, result) => {});
  sub.on("data", async (data) => {
    console.log(`new block: ${data.number} at ${Date.now()}`);
    setNextBlockEst(new BigNumber(data.timestamp).plus(3000).toNumber());
  });
  sub.on("error", async (err) => {
    console.error(err);
  });
  while (true) {
    await handleBlock(new Map(), nextBlockEst);
  }
}

async function run() {
  if (!args[0] || args[0] === "currentBlock") {
    await currentBlockStrategy();
  } else if (args[0] === "mempool") {
    console.log("Running MemPool Strategy");
    await memPoolStrategy();
  } else if (args[0] === "seconds") {
    console.log("Running Seconds Strategy");
    await everySecond();
  }
}

run();
