import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SealedBidAuction", (m) => {
  const deployer = m.getAccount(0);

  const sealedBidAuction = m.contract("SealedBidAuction", [
    7n * 24n * 60n * 60n,
    3n * 24n * 60n * 60n,
    deployer,
  ]);

  return { sealedBidAuction };
});
