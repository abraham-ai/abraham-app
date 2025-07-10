import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import { HardhatUserConfig } from "hardhat/config";
const config: HardhatUserConfig = {
  solidity: "0.8.28",
  typechain: {
    outDir: "typechain-types",
  },
};

export default config;
