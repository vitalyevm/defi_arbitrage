// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import { WBNB } from "../src/constants";
import deployer from "../.secret";

async function main() {
  const Greeter = await ethers.getContractFactory("UltimaBalancer");

  const overrides = {
    gasPrice: ethers.utils.parseUnits('5', 'gwei'),
    gasLimit: 5000000,
  };
  const greeter = await Greeter.deploy(deployer.address, overrides);

  await greeter.deployed();

  console.log("Greeter deployed to:", greeter.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
