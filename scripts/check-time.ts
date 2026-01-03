import hre from "hardhat";

async function main() {
  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  const auction = await viem.getContractAt("SealedBidAuction", "0x5fbdb2315678afecb367f032d93f642f64180aa3");
  
  const [commitEnd, revealEnd] = await Promise.all([
    auction.read.commitEndTime(),
    auction.read.revealEndTime(),
  ]);
  
  const currentBlock = await publicClient.getBlock();
  
  console.log("Commit ends at:", Number(commitEnd));
  console.log("Reveal ends at:", Number(revealEnd));
  console.log("Current timestamp:", Number(currentBlock.timestamp));

  if (Number(currentBlock.timestamp) < Number(commitEnd)) {
    console.log("\nAdvancing time past commit phase...");
    const targetTime = Number(commitEnd) + 1;
    await testClient.setNextBlockTimestamp({ timestamp: targetTime });
    await testClient.mine({ blocks: 1 });
    console.log("Time advanced to:", targetTime);
  } else {
    console.log("\nCommit phase already ended. Ready to reveal.");
  }
}

main().catch(console.error);
