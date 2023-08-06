import { UltimaBalancer } from './../typechain/UltimaBalancer';
import fs from "fs";
import {BigNumber} from "bignumber.js";
import {PancakeFactory} from "../typechain/PancakeFactory";
import Web3 from "web3";
import net from "net";
import secrets from "../.secret";
import tokens from "../data/tokens.json"

export const IERC20_ABI = JSON.parse(fs.readFileSync('artifacts/contracts/libraries/pancake/interfaces/IPancakeERC20.sol/IPancakeERC20.json', 'utf8'));
export const PANCAKE_FACTORY = JSON.parse(fs.readFileSync('artifacts/contracts/libraries/pancake/PancakeFactory.sol/PancakeFactory.json', 'utf8'));
export const UNISWAP_PAIR = JSON.parse(fs.readFileSync('artifacts/contracts/libraries/pancake/PancakePair.sol/PancakePair.json', 'utf8'));
export const PANCAKE_ROUTER_V2_ABI = JSON.parse(fs.readFileSync('artifacts/contracts/libraries/pancake-perph/PancakeRouter01.sol/PancakeRouter01.json', 'utf8'));
export const PANCAKE_ROUTER_V3_ABI = JSON.parse(fs.readFileSync('data/abiv3.json', 'utf8'));

export const ULTIMA_BALANCER = JSON.parse(fs.readFileSync('artifacts/contracts/UltimaBalancer.sol/UltimaBalancer.json', 'utf8'));

export const PANCAKE_ROUTER_ADDRESS_V3 = '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4'.toLowerCase();
export const PANCAKE_FACTORY_ADDRESS_V3 = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';
export const PANCAKE_ROUTER_ADDRESS_V2 = '0x10ED43C718714eb63d5aA57B78B54704E256024E'.toLowerCase();
export const PANCAKE_FACTORY_ADDRESS_V2 = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
export const PANCAKE_ROUTER_ADDRESS_V1 = '0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F'.toLowerCase();
export const PANCAKE_FACTORY_ADDRESS_V1 = '0xBCfCcbde45cE874adCB698cC183deBcF17952812';

export const FACTORY_V2_INIT_CODE_HASH = "0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5";
export const FACTORY_V1_INIT_CODE_HASH = "0xd0d4c4cd0848c93cb4fd1f498d7013ee6bfb25783ea21593d5834f5d250ece66";
export const ULTIMA_BALANCER_ADDRESS = '0x92fFb71Bd3E8a8a962221309d4eb629Ba67CC8be';
export const FLASH_BOT_BALANCER_ADDRESS = '0x6d8FD7f8b25D3fDe9eC75628B64f631698279F49';

export const PRIVATE_KEY = secrets.private;
export const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'.toLowerCase();
export const WBNB_DECIMALS = new BigNumber(10).exponentiatedBy(18);
export const BSC_CHAIN_ID = 56;

export const EXCHANGES: { [router: string]: string } = {
    [PANCAKE_ROUTER_ADDRESS_V3]: 'PancakeSwapV3',
    [PANCAKE_ROUTER_ADDRESS_V2]: 'PancakeSwapV2',
    [PANCAKE_ROUTER_ADDRESS_V1]: 'PancakeSwapV1',
}

export const ROUTER_SWAP_METHODS = [
    'multicall',
    'swapExactETHForTokens',
    'swapExactTokensForETH',
    'swapETHForExactTokens',
    'swapExactETHForTokensSupportingFeeOnTransferTokens',
    'swapExactTokensForETHSupportingFeeOnTransferTokens',
    'swapExactTokensForTokens',
    'swapExactTokensForTokensSupportingFeeOnTransferTokens',
    // 'swapTokensForExactTokens',
    // 'swapTokensForExactETH',
];

export const ROUTER_SWAP_METHODS_B_TO_A = [
    'swapExactTokensForETH',
    'swapETHForExactTokens',
    'swapExactETHForTokensSupportingFeeOnTransferTokens',
    'swapExactTokensForETHSupportingFeeOnTransferTokens',
    'swapExactTokensForTokens',
    'swapExactTokensForTokensSupportingFeeOnTransferTokens',
];

export const ROUTER_SWAP_METHODS_A_TO_B = [
    'swapExactTokensForETH',
    'swapExactTokensForETHSupportingFeeOnTransferTokens',
    'swapExactTokensForTokens',
    'swapExactTokensForTokensSupportingFeeOnTransferTokens',
    'swapTokensForExactTokens',
    'swapTokensForExactETH',
];

export const ROUTER_LIQUIDITY_METHODS = [
    'addLiquidity',
    'addLiquidityETH',
    'removeLiquidity',
    'removeLiquidityETH',
    'removeLiquidityWithPermit',
    'removeLiquidityETHWithPermit',
    'removeLiquidityETHSupportingFeeOnTransferTokens',
    'removeLiquidityETHWithPermitSupportingFeeOnTransferTokens'
]

export const HTTP_PROVIDER_LINK = process.env.HTTP_PROVIDER;
export const WEBSOCKET_PROVIDER_LINK = process.env.WEBSOCKET_PROVIDER;

console.log(`env:\t\t ${process.env.PROD}`);
console.log(`reindex db:\t ${process.env.REINDEX_DB}`);
console.log(`http:\t\t ${HTTP_PROVIDER_LINK}`);
console.log(`ws:\t\t ${WEBSOCKET_PROVIDER_LINK}`);

if (!HTTP_PROVIDER_LINK || !WEBSOCKET_PROVIDER_LINK) {
    console.log('empty links');
    process.exit();
}

export let web3 = new Web3(process.env.PROD ? new Web3.providers.IpcProvider(HTTP_PROVIDER_LINK, net) : new Web3.providers.HttpProvider(HTTP_PROVIDER_LINK));
web3.eth.accounts.wallet.add(PRIVATE_KEY);
export const web3Ws = new Web3(process.env.PROD ? new Web3.providers.IpcProvider(WEBSOCKET_PROVIDER_LINK, net) : new Web3.providers.WebsocketProvider(WEBSOCKET_PROVIDER_LINK));
export function overRideWeb3(newWeb3: Web3){
    web3 = newWeb3;
}
web3.eth.getNodeInfo()
    .then(nodeInfo => {
        console.log('Connected to IPC');
        console.log('Node info:', nodeInfo);
    })
    .catch(error => {
        console.error('Failed to connect to IPC:');
        console.error('Error:', error.message);
    });

export const REINDEX_DB = process.env.REINDEX_DB === 'false' ? false : true;

export const pancakeFactoryV3 = (new web3.eth.Contract(PANCAKE_ROUTER_V3_ABI, PANCAKE_FACTORY_ADDRESS_V2) as any) as PancakeFactory;
export const pancakeFactoryV2 = (new web3.eth.Contract(PANCAKE_FACTORY.abi, PANCAKE_FACTORY_ADDRESS_V2) as any) as PancakeFactory;
export const pancakeFactoryV1 = (new web3.eth.Contract(PANCAKE_FACTORY.abi, PANCAKE_FACTORY_ADDRESS_V1) as any) as PancakeFactory;

export const ultimaBalancer = (new web3.eth.Contract(ULTIMA_BALANCER.abi, ULTIMA_BALANCER_ADDRESS) as any) as UltimaBalancer;
export const wsUltimaBalancer = (new web3Ws.eth.Contract(ULTIMA_BALANCER.abi, ULTIMA_BALANCER_ADDRESS) as any) as UltimaBalancer;

export const ROUTERS: { [router: string]: PancakeFactory } = {
    [PANCAKE_ROUTER_ADDRESS_V3]: pancakeFactoryV3,
    [PANCAKE_ROUTER_ADDRESS_V2]: pancakeFactoryV2,
    [PANCAKE_ROUTER_ADDRESS_V1]: pancakeFactoryV1,
}
export const ROUTER_LIST = Object.keys(ROUTERS);

export const userWallet = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);

export const estGasCost = new BigNumber(web3.utils.toWei('0.002', 'ether'));

export const WHITELIST = tokens;

const denyTokens = ['cake'];
const filterDenyList = tokens.filter(token => denyTokens.includes(token.symbol.toLowerCase()));

export const DENY_LIST: {tokens: {address:string}[]} = {tokens: filterDenyList};
export const allowed = new Map(WHITELIST.map(token => [token.address.toString().toLowerCase(), true]));
export const disallowed = new Map(DENY_LIST.tokens.map(token => [token.address.toString().toLowerCase(), true]));