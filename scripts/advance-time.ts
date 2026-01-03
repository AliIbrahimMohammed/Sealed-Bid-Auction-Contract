import hre from "hardhat";

const AUCTION_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

async function main(): Promise<void> {
  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const auction = await viem.getContractAt("SealedBidAuction", AUCTION_ADDRESS);

  const [commitEnd, revealEnd] = await Promise.all([
    auction.read.commitEndTime(),
    auction.read.revealEndTime(),
  ]);

  const currentBlock = await publicClient.getBlock();

  console.log("Current timestamp:", Number(currentBlock.timestamp));
  console.log("Commit ends at:", Number(commitEnd));
  console.log("Reveal ends at:", Number(revealEnd));

  if (Number(currentBlock.timestamp) < Number(commitEnd)) {
    console.log("\n>>> Advancing time past COMMIT phase...");
    const targetTime = Number(commitEnd) + 1;
    await testClient.setNextBlockTimestamp({ timestamp: BigInt(targetTime) });
    await testClient.mine({ blocks: 1 });
    console.log(">>> Time advanced to:", targetTime);
  } else if (Number(currentBlock.timestamp) < Number(revealEnd)) {
    console.log("\n>>> Advancing time past REVEAL phase...");
    const targetTime = Number(revealEnd) + 1;
    await testClient.setNextBlockTimestamp({ timestamp: BigInt(targetTime) });
    await testClient.mine({ blocks: 1 });
    console.log(">>> Time advanced to:", targetTime);
  } else {
    console.log("\n>>> Both phases ended. Ready to finalize!");
  }
}

main().catch(console.error);
