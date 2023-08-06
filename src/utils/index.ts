import fs from "fs";
import Web3 from "web3";
import { utils } from "ethers";
import {DecodedFunction, EthereumAddress, PoolInfo, PrimedPoolFile, TokenInfo} from "../index";
import {
    estGasCost,
    overRideWeb3,
    PANCAKE_ROUTER_V2_ABI,
    PANCAKE_ROUTER_V3_ABI,
    WBNB,
    WBNB_DECIMALS,
    PANCAKE_ROUTER_ADDRESS_V2
} from "../constants";

const colors = require('colors');

const abiDecoder = require('abi-decoder');
abiDecoder.addABI(PANCAKE_ROUTER_V3_ABI);
abiDecoder.addABI(PANCAKE_ROUTER_V2_ABI.abi);
// abiDecoder.addABI(BISWAP_ROUTER.abi);


import {BigNumber} from "bignumber.js"
import {
    bnbPoolIndex,
} from "../store";

export function decode(input: string, isV3: boolean): DecodedFunction | null {
    const decodedData = abiDecoder.decodeMethod(input); // TODO something wrong with this decode check - 0x5388376ee16d077812160cc219b28a9adad40cb194f8b580705854c2da7f6c8f
    if (!decodedData || !decodedData.params || !decodedData.params[1] || !decodedData.params[1].value) return null;
    
    if (isV3) {
        const innerData = decodedData.params[1].value
        const innerDecodedData = abiDecoder.decodeMethod(innerData[0]);
        
        if (!innerDecodedData) return null;
    
        const method = innerDecodedData.name;
        const params = innerDecodedData.params;
        return {name: method, params}
    }

    const method = decodedData['name'];
    const params = decodedData['params'];
    return {name: method, params}

}

export function isLowerCaseEthereumAddress(address: string): boolean {
    if (!utils.isAddress(address)) {
        return false;
    }

    // Check if the address is lowercase
    if (address.toLowerCase() !== address) {
        return false;
    }

    return true;
}

export function convertToBNB(token: string, amount: BigNumber): BigNumber | undefined {
    if (token.toLowerCase() === WBNB) return amount;

    const pool = bnbPoolIndex[token];
    if (pool) {
        const reserveIn = pool.token0 === token ? pool.reserve0 : pool.reserve1;
        const reserveOut = pool.token0 === token ? pool.reserve1 : pool.reserve0;
        return getAmountOut(amount, reserveIn, reserveOut, pool.fee)
    }
}

// Same as calling this on the node
// Pancake fee === 2
// Biswap fee === (pair based fee)
export function getAmountOut(amountIn: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber, swapFee: number): BigNumber {
    const multiple = new BigNumber(1000);
    const amountInWithFee = amountIn.times(multiple.minus(swapFee));
    const numerator = amountInWithFee.times(reserveOut);
    const denominator = reserveIn.times(multiple).plus(amountInWithFee);
    return numerator.div(denominator);
}

// given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
export function quote(amountA: BigNumber, reserveA: BigNumber, reserveB: BigNumber): BigNumber {
    return amountA.times(reserveB).div(reserveA);
}

export function getFee(router_address: string): number {
    if (router_address === PANCAKE_ROUTER_ADDRESS_V2) {
        return 2
    } else {
        return 3;
    }
}