import { ultimaBalancer } from './../src/constants';
const { expect } = require("chai");
const hre = require("hardhat");
const BigNumberS = require("bignumber.js");
const { waffle, ethers } = require("hardhat");
const { constants, getSigners, Contract, BigNumber, utils } = ethers;
const { WeiPerEther } = constants;
// const { computeProfitMaximizingTradeBN, computeProfitMaximizingTrade } = require("../utils");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const ERC20 = require("@uniswap/v2-periphery/build/ERC20.json")
const WETH9 = require("@uniswap/v2-periphery/build/WETH9.json")
const UniswapV2Router = require("@uniswap/v2-periphery/build/UniswapV2Router01.json")
const UniswapV2Factory = require("@uniswap/v2-core/build/UniswapV2Factory.json")
const UniswapV2Pair = require("@uniswap/v2-core/build/UniswapV2Pair.json")

describe("UltimaBalancerS", function () {
  let weth: any;
  let ultimaBalancer: any;
  let owner: any;
  let trader: any;
  let token: any;
  let ultimaBalancerAbi: any;
  let advancedAbitrager: any;
  let uniswapFactory: any;
  let uniswapRouter: any;
  let yfiiV1: any;
  let sushiFactory: any;
  let sushiRouter: any;
  let yfiiV2: any;
  let snapshotId: string;

  async function deployWETH(depositAmount: any) {
    weth = await waffle.deployContract(owner, WETH9);
    await weth.deposit({ value: depositAmount });
  }

  async function deployToken(mintAmount: any) {
    token = await waffle.deployContract(owner, ERC20, [mintAmount])
  }

  function getAmountOut(
    amountIn: any,
    reserveIn: any,
    reserveOut: any,
    slippageTolerance?: any
  ): any { 
    const amountInWithFee = amountIn.mul(997);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    const amountOut = numerator.div(denominator);

    if (slippageTolerance) {
      const slippageToleranceNumerator = 100 - (slippageTolerance * 100);
      const slippageToleranceDenominator = 100;
      const amountOutMin = amountOut.mul(slippageToleranceNumerator).div(slippageToleranceDenominator);
      return amountOutMin;
    }
  
    return amountOut;
  }

  function getAmountIn(
    amountOut: any,
    reserveIn: any,
    reserveOut: any,
    slippageTolerance?: any
  ): any { 
    const numerator = reserveIn.mul(amountOut).mul(1000);
    const denominator = reserveOut.sub(amountOut).mul(997);
    const amountIn = numerator.div(denominator).add(1);

    if (slippageTolerance) {
      const amountInMin = amountIn.mul(ethers.BigNumber.from(10000).add(ethers.BigNumber.from(Math.round(slippageTolerance * 10000)))).div(ethers.BigNumber.from(10000));
      return amountInMin;
    }
    
    return amountIn;
  }
  
  function decodeTransactionData(abi: any, data: string) {
    try {
      const decodedData = abi.parseTransaction({ data });
      console.log(decodedData);
    } catch (error) {
      console.error("Unable to decode transaction data:", error);
    }
  }

  async function deployDEX(liquidityAmountYFII: any, liquidityAmountWBNB: any) {
    console.log('deploy dex');
    const factory = await waffle.deployContract(owner, UniswapV2Factory, [owner.address])
    await factory.deployed()
    const router = await waffle.deployContract(owner, UniswapV2Router, [factory.address, weth.address])
    await router.deployed()
    await factory.createPair(token.address, weth.address)
    const pairAddress = await factory.getPair(weth.address, token.address)
    const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), owner)

    // Add liquidity
    await token.connect(owner).transfer(pairAddress, liquidityAmountYFII, { gasLimit: 10000000 })
    await weth.connect(owner).transfer(pairAddress, liquidityAmountWBNB, { gasLimit: 10000000 })
    await pair.connect(owner).mint(owner.address)

    // console.log('\npair tokens', await pair.token0(), await pair.token1())

    return { factory, router, pair }
  }

  before("Deploy contracts", async function () {
    // await helpers.reset();
    console.log('Deploy contracts');
    const accounts = await getSigners();
    owner = accounts[0];
    trader = accounts[1];
    // Deploy tokens
    await deployWETH(WeiPerEther.mul(3000));
    await deployToken(WeiPerEther.mul(3000));
    // if (weth.address < token.address) {  // TODO ATTENTION
    //   const tempToken = weth;
    //   weth = token;
    //   token = tempToken;
    // }
    // Deploy exchanges
    // const pancakeV1 = await deployDEX(WeiPerEther.mul(10), WeiPerEther.mul(30));
    // const pancakeV2 = await deployDEX(WeiPerEther.mul(50), WeiPerEther.mul(150));
    const pancakeV1 = await deployDEX('93008201538118458949059', '298335315868806254');
    const pancakeV2 = await deployDEX('2208497519119440899669', '7406393554359578');
    // const pancakeV2 = await deployDEX('2453535129551466090', '9985862526186100339');

    uniswapFactory = pancakeV2.factory;
    uniswapRouter = pancakeV2.router;
    yfiiV2 = pancakeV2.pair;
    sushiFactory = pancakeV1.factory;
    sushiRouter = pancakeV1.router;
    yfiiV1 = pancakeV1.pair;
  
    // Deploy arbitrager
    const UltimaBalancer = await ethers.getContractFactory("UltimaBalancer", owner);
    ultimaBalancer = await UltimaBalancer.deploy(owner.address);
    await ultimaBalancer.deployed({
      gasPrice: ethers.utils.parseUnits('5', 'gwei'),
      gasLimit: 5000000,
    });
    ultimaBalancerAbi = UltimaBalancer.interface;
    // console.log('ultima address', ultimaBalancer.address);

    await weth.connect(owner).approve(yfiiV2.address, ethers.constants.MaxUint256);
    await token.connect(owner).approve(yfiiV2.address, ethers.constants.MaxUint256);
    await weth.connect(owner).approve(uniswapRouter.address, ethers.constants.MaxUint256);
    await token.connect(owner).approve(uniswapRouter.address, ethers.constants.MaxUint256);
    await weth.connect(owner).transfer(ultimaBalancer.address, utils.parseEther("10"));
    await token.connect(owner).transfer(ultimaBalancer.address, utils.parseEther("10"));
    console.log('smart contract WETH balancee', await weth.balanceOf(ultimaBalancer.address));
    console.log('smart contract TOKEN balancee', await token.balanceOf(ultimaBalancer.address));
    console.log('owner WETH balance', await weth.balanceOf(owner.address));
    console.log('owner TOKEN balance', await token.balanceOf(owner.address));
    console.log('trader WETH balance', await weth.balanceOf(trader.address));
    console.log('trader TOKEN balance', await token.balanceOf(trader.address));
    console.log('--==--==--');

    // console.log('yfiiV1', await token.balanceOf(trader.address));
    // console.log('yfiiV2', await token.balanceOf(trader.address));
});

  describe("Main Task", function () {
    it("gas estimation, price disparity, amount of ETH to maximize profit", async function () {  
      // console.log('asdasd', ethers.BigNumber.from('0.000001').lt(ethers.BigNumber.from('0.001')));
      console.log(owner)
      const v1Reserve = await yfiiV1.getReserves();
      console.log('v1Reserve', v1Reserve)
      const v2Reserve = await yfiiV2.getReserves();
      console.log('v2Reserve', v2Reserve)

      console.log(await token.decimals())
      console.log(ethers.utils.parseEther("1"))
      console.log(WeiPerEther.mul(1).toString())
      
      const ownerAddress = await owner.getAddress();
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now;
      const amountIn = WeiPerEther.mul(1);
      const slippageTolerance = 0.01; // 1% slippage tolerance

      const amountOut = getAmountOut(ethers.utils.parseEther("1"), v2Reserve[1], v2Reserve[0], slippageTolerance);
      // const amountOut = getAmountOut(ethers.utils.parseEther("1"), v2Reserve[0], v2Reserve[1], slippageTolerance);
      // const amountInTemp = getAmountIn(amountOut, v2Reserve[0], v2Reserve[1], slippageTolerance);
      const amountInTemp = getAmountIn(ethers.utils.parseEther("1"), v2Reserve[1], v2Reserve[0], slippageTolerance);
      // console.log('amounts', amountOut, amountInTemp);

      // await uniswapRouter.swapExactETHForTokens(0, [weth.address, token.address], ownerAddress, deadline, { 
      //   value: utils.parseEther("1"), 
      //   gasPrice: ethers.utils.parseUnits('7', 'gwei'),
      //   gasLimit: 500000 
      // });   

      // await uniswapRouter.swapExactTokensForETH(amountInTemp, amountOut, [token.address, weth.address], ownerAddress, deadline, { 
      //   // value: utils.parseEther("1"), 
      //   gasPrice: ethers.utils.parseUnits('7', 'gwei'),
      //   gasLimit: 500000 
      // });   
      // 1000000000000000000
      // 9373828271466066740
      const pools = [yfiiV2.address, yfiiV1.address];
      console.log('wbnb', weth.address);
      console.log('token', token.address);
      console.log('yfiiV2', yfiiV2.address);
      console.log('yfiiV1', yfiiV1.address);
      console.log('--==--==--');


      const result = await ultimaBalancer.connect(owner).getProfit(pools[0], pools[1], { 
          gasPrice: ethers.utils.parseUnits('7', 'gwei'),
          gasLimit: 500000 
      })
      console.log('res', result);
      // if (ethers.BigNumber.from(result.profit).lt(utils.parseEther('0.001').toString())){
      //   console.log('adsadsadasd')
      // }
      console.log(`Profit on ${pools}: ${ethers.utils.formatEther(result.profit)}; wei ${result.profit}`);
      const data = await ultimaBalancer.connect(owner).executes(yfiiV1.address, yfiiV2.address);
      console.log(data);
      const orderedReserves = {
        a1: '49669860990615707597',
        a2: '10000000000000000000',
        b1: '151000000000000000000',
        b2: '30000000000000000000',
      };
      // const gasEstimate1 = await ultimaBalancer.connect(owner).estimateGas.calcBorrowAmount(orderedReserves, { 
      //   from: owner.address,
      // });
      
      const calldata = {
        pool0: yfiiV1.address,
        pool1: yfiiV2.address,
        baseToken: token.address,
        count: 100 + 100 * 0.19
      }

      // const est = await ultimaBalancer.connect(owner).getProfit(calldata, {
      //   from: owner.address
      // });
      // console.log(est)
      
      // const gasEstimate = await ultimaBalancer.connect(owner).estimateGas.executes(calldata, { 
      //   from: owner.address,
      //   gasPrice: ethers.utils.parseUnits('7', 'gwei'),
      //   gasLimit: 500000 
      // });
      // console.log(gasEstimate)

      
      // const data = await ultimaBalancer.connect(owner).executeV1(weth.address, token.address, yfiiV2.address, yfiiV1.address);
      // const data = await ultimaBalancer.connect(owner).executeV3(yfiiV2.address, yfiiV1.address, amountOut, false);
      // decodeTransactionData(ultimaBalancerAbi, data.data);

    //   let uReserveEth, uReserveTkn, sReserveEth, sReserveTkn
    //   if (weth.address < token.address) {
    //     v1ReserveEth = uReserve._reserve0;
    //     v1ReserveTkn = uReserve._reserve1;
    //     v2ReserveEth = sReserve._reserve0;
    //     v2ReserveTkn = sReserve._reserve1;
    //   } else {
    //     v1ReserveEth = uReserve._reserve1;
    //     v1ReserveTkn = uReserve._reserve0;
    //     v2ReserveEth = sReserve._reserve1;
    //     v2ReserveTkn = sReserve._reserve0;
    //   }
    //   const result = await computeProfitMaximizingTradeBN(sReserveEth, sReserveTkn, uReserveEth, uReserveTkn);
    //   let resultOk = true;
    //   if (result.x.gt(0)) {
    //     if (result.x.gt(uReserveTkn)) {
    //       resultOk = false;
    //     }
    //     if (result.y.gt(sReserveEth)) {
    //       resultOk = false;
    //     }
    //   } else {
    //     if (result.x.lt((sReserveTkn).mul(-1))) {
    //       resultOk = false;
    //     }
    //     if (result.y.lt((uReserveEth).mul(-1))) {
    //       resultOk = false;
    //     }
    //   }
    //   if (!resultOk) {
    //     // ignoring result that doesn't make sense
    //     consoleLogs.push(`Result doesn't make sense`);
    //     await expect(arbitrager.connect(trader).arbitrage(token.address, result.x.gt(0) ? uniswapFactory.address : sushiFactory.address, result.x.gt(0) ? sushiFactory.address : uniswapFactory.address, { value: result.x }))
    //         .to.be.revertedWith(`No profit`);
    //   } else {
    //     const signChange = ethers.BigNumber.from(result.x.gt(0) ? 1 : -1);
    //     if (result.profit.mul(signChange).gt(0)) {
    //       consoleLogs.push(
    //         `X: ${ethers.utils.formatUnits(
    //           result.x.mul(signChange))} tkn (from ${result.x.gt(0) ? "Uniswap" : "Sushiswap"
    //         })`,
    //       );
    //       consoleLogs.push(
    //         `Y: ${ethers.utils.formatUnits(
    //           result.y.mul(signChange))} eth (to ${result.x.gt(0) ? "Sushiswap" : "Uniswap"})`,
    //       );
    //       consoleLogs.push(
    //         `Z: ${ethers.utils.formatUnits(
    //           result.z.mul(signChange))} eth (entry)`,
    //       );
    //       consoleLogs.push(
    //         `Theoretical Profit: ${ethers.utils.formatUnits(
    //           result.profit.mul(signChange))} eth`,
    //       );
    //       if( result.profit.lt(gas.mul(gasprice))){
    //         consoleLogs.push(`Result is not profitable considering gas cost`);
    //         await expect(arbitrager.connect(trader).arbitrage(token.address, result.x.gt(0) ? uniswapFactory.address : sushiFactory.address, result.x.gt(0) ? sushiFactory.address : uniswapFactory.address, { value: result.x }))
    //         .to.be.revertedWith(`No profit`);
    //       } else {
    //         const estimation = await arbitrager.estimateGas.arbitrage(token.address, result.x.gt(0) ? uniswapFactory.address : sushiFactory.address, result.x.gt(0) ? sushiFactory.address : uniswapFactory.address, { value: result.x });
    //         await arbitrager.setGasUsed(estimation);
    //         const bal0 = ethers.utils.formatEther(await ethers.provider.getBalance(trader.address));
    //         await arbitrager.connect(trader).arbitrage(token.address, result.x.gt(0) ? uniswapFactory.address : sushiFactory.address, result.x.gt(0) ? sushiFactory.address : uniswapFactory.address, { value: result.x });
    //         const bal1 = ethers.utils.formatEther(await ethers.provider.getBalance(trader.address))
    //         consoleLogs.push(`Actual Profit: ${bal1 - bal0}`);
    //         consoleLogs.push(`Gas estimation: ${ethers.BigNumber.from(estimation).toNumber()}`);
    //         consoleLogs.push(`ETH to maximize profit: ${ethers.utils.formatUnits(result.z.mul(signChange))}`);
    //         expect(bal1-bal0).to.be.above(0);
    //       }
    //     } else {
    //       consoleLogs.push(`Result is not profitable`);
    //       await expect(arbitrager.connect(trader).arbitrage(token.address, result.x.gt(0) ? uniswapFactory.address : sushiFactory.address, result.x.gt(0) ? sushiFactory.address : uniswapFactory.address, { value: result.x }))
    //         .to.be.revertedWith(`No profit`);
    //     }
    //   }
    //   var ok = false;
    //   var res;
    //   var sREth=100, sRTkn=100, uREth=100, uRTkn=100
    //   while(!ok){
    //     res = await computeProfitMaximizingTrade(sREth, sRTkn, uREth, uRTkn);
    //     if(res.x>0 && res.profit > ethers.utils.formatEther(gas.mul(gasprice))){
    //       ok = true;
    //     } else {
    //       sREth+=0.00001;
    //     }
    //   }
    //   consoleLogs.push(`Minimum price disparity: ${sREth/sRTkn-uREth/uRTkn} eth/tkn`);
    //   console.log(consoleLogs.join("\n"));
    })
  })
  // describe("Additional Challenges", function () {
  //   it("support arbitrary token pairs, flash swap", async function () {
  //   //   await advancedAbitrager.connect(trader).arbitrage(
  //   //     token.address,
  //   //     weth.address,
  //   //     // uniswapPair.address,
  //   //     // sushiPair.address
  //   //   );
  //   });
  //   it("profit-sharing", async () => {
  //     expect(Number(ethers.utils.formatEther(await advancedAbitrager.profits(trader.address, weth.address)))).to.above(0)
  //   })
  // })

});

    // COMMON FUNCTIONS
    // await yfiiV2.connect(owner).swap('185829680666057840', 0, owner.address, "0x", {
    //   gasLimit: 500000,
    // });
    // await weth.connect(owner).approve(yfiiV2.address, ethers.constants.MaxUint256);
    // await pair.connect(owner).mint(owner.address)
    // const wethBalance = await weth.balanceOf(owner.address);
    // const amountOut = ethers.utils.parseEther("1").mul(v2Reserve[1]).div(v2Reserve[0]);

    // await weth.approve(yfiiV2.address, ethers.constants.MaxUint256);
    // await yfiiV2.connect(owner).swap(amountOut, 0, owner.address, "0x", {
    //   // value: '1000000000000000000',
    //   gasLimit: 500000,
    // });
    // await owner.sendTransaction({
    //   to: ultimaBalancer.address,
    //   value: ethers.utils.parseEther(amount),
    // });
    // await weth.connect(owner).transfer(ultimaBalancer.address, ethers.utils.parseUnits(amount, await weth.decimals()));

  // beforeEach(async function () {
  //   await hre.network.provider.send("hardhat_reset")
  //   snapshotId = await ethers.provider.send("evm_snapshot", []);
  // });

  // afterEach(async function () {
  //   await ethers.provider.send("evm_revert", [snapshotId]);
  // });

      // await weth.connect(owner).approve(yfiiV2.address, ethers.constants.MaxUint256);
      // await yfiiV2.connect(owner).swap(0, amountOut, owner.address, "0x", {
      //   // value: '1000000000000000000',
      //   gasLimit: 500000,
      // });
      // console.log('owner token balancee', await token.balanceOf(owner.address));

      // await uniswapRouter.swapExactETHForTokens(0, [weth.address, token.address], ownerAddress, deadline, { 
      //   value: WeiPerEther.mul(1), 
      //   gasPrice: ethers.utils.parseUnits('7', 'gwei'),
      //   gasLimit: 500000 
      // });      
      // owner.send()