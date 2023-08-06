import * as dotenv from "dotenv";
dotenv.config({path: process.env.NODE_ENV === 'prod' ? `.env.prod` : `.env.development`});
// dotenv.config({path: `.env.development`});

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

import deployer from "./.secret";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});
const HTTP_PROVIDER = process.env.HTTP_PROVIDER;

const LOW_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    evmVersion: 'istanbul',
    optimizer: {
      enabled: true,
      runs: 2_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const LOWEST_OPTIMIZER_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    evmVersion: 'istanbul',
    optimizer: {
      enabled: true,
      runs: 1_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

const DEFAULT_COMPILER_SETTINGS = {
  version: '0.7.6',
  settings: {
    evmVersion: 'istanbul',
    optimizer: {
      enabled: true,
      runs: 1_000_000,
    },
    metadata: {
      bytecodeHash: 'none',
    },
  },
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    overrides: {
      'contracts/libraries/pancakev3-perph/NonfungiblePositionManager.sol': LOW_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/libraries/pancakev3-perph/NonfungibleTokenPositionDescriptor.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/libraries/pancakev3-perph/libraries/NFTDescriptor.sol': LOWEST_OPTIMIZER_COMPILER_SETTINGS,
      'contracts/libraries/pancakev3-perph/libraries/PoolTicksCounter.sol': DEFAULT_COMPILER_SETTINGS,
      'contracts/libraries/pancakev3-perph/libraries/PoolAddress.sol': DEFAULT_COMPILER_SETTINGS,
      'contracts/libraries/pancakev3-perph/libraries/ChainId.sol': DEFAULT_COMPILER_SETTINGS,
      'contracts/libraries/pancakev3-perph/lens/TickLens.sol': DEFAULT_COMPILER_SETTINGS,
      '@uniswap/v3-core/contracts/libraries/TickBitmap.sol': DEFAULT_COMPILER_SETTINGS,
      '@uniswap/lib/contracts/libraries/AddressStringUtil.sol': { version: '0.5.0' },
      '@uniswap/lib/contracts/libraries/SafeERC20Namer.sol': { version: '0.5.0' },
    },
    compilers: [
      { version: "0.5.16" },
      // { version: "0.6.0" },
      { version: "0.6.6" },
      { version: "0.7.6" },
      { 
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1_000_000,
          },
          metadata: {
            bytecodeHash: 'none',
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      // loggingEnabled: true,
      // forking: {
      //   url: HTTP_PROVIDER as string, 
      //   enabled: true,
      // },
      accounts: {
        accountsBalance: "10000000000000000000000000000", // 1 mil ether
      },
    },
    // ropsten: {
    //   url: process.env.ROPSTEN_URL || "",
    //   accounts:
    //     process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    // },
    bsc: {
      url: 'https://bsc-dataseed.binance.org/',
      chainId: 0x38,
      accounts: [deployer.private],
      // gasPrice: 2000000,
      from: deployer.address,
    },
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 11,
    token: "BNB",
    gasPriceApi: "https://api.bscscan.com/api?module=proxy&action=eth_gasPrice",
    enabled: false,
  },
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY,
  // },
  typechain: {
    target: "web3-v1",
  },
  mocha: {
    timeout: 200000,
  },
};

export default config;
