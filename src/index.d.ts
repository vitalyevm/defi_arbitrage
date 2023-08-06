import { PoolVersion } from "@prisma/client";
import {BigNumber} from "bignumber.js";
import { PancakePair } from "../typechain/PancakePair";

declare module 'canoe-solidity';

type EthereumAddress = string;

type TokenInfo = {
    id: string;
    chainId: number;
    name: string;
    symbol: string;
    decimals: string;
    address: string;
}

type PoolInfoDb = {
    hashCode: string;
    valid: boolean;
    version: PoolVersion;
    contract: PancakePair;
    address: string;
    reserve0: BigNumber;
    reserve1: BigNumber;
    token0: TokenInfo;
    token1: TokenInfo;
    // token0Id: string;
    // token1Id: string;
    fee: number;
    exchange: string;
}

type PoolInfo = Omit<PoolInfoDb, 'token0' | 'token1'> & {
    token0: string;
    token1: string;
};

type Reserves = {reserve0: BigNumber, reserve1: BigNumber};

type PoolsToUpdate = Map<string, { 
    in_token: string, 
    out_token: string, 
    router: string, 
    gas: number,
    amountIn?: any, 
    amountOut?: any, 
    aToB?: boolean 
}>;

type DecodedFunction = {
    name: string;
    params: {
        name: string;
        value: string | string[];
        type: string
    }[]
}

type PrimedPoolFile = {
    pools: PoolInfo[];
    tokens: TokenInfo[];
};

type Chain = { mainPool: string, pools?: string[], extraPools: string[], tokens: string[], gas?: number, amount?: any, aToB?: boolean };