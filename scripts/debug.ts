import hre from "hardhat";

async function main(): Promise<void> {
  const AUCTION_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
  
  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();
  
  const auction = await viem.getContractAt("SealedBidAuction", AUCTION_ADDRESS);
  
  const [commitEndTime, revealEndTime, currentBlock] = await Promise.all([
    auction.read.commitEndTime(),
    auction.read.revealEndTime(),
    publicClient.getBlock(),
  ]);
  
  console.log("=== Contract State Debug ===");
  console.log("Current timestamp:", Number(currentBlock.timestamp));
  console.log("Commit ends at:", Number(commitEndTime));
  console.log("Reveal ends at:", Number(revealEndTime));
  console.log("Commit phase active:", Number(currentBlock.timestamp) <= Number(commitEndTime));
  console.log("Reveal phase active:", Number(currentBlock.timestamp) >= Number(commitEndTime) && Number(currentBlock.timestamp) <= Number(revealEndTime));
  
  console.log("\n=== Bids Committed ===");
  const testAddress = walletClients[1].account.address;
  const commitment = await auction.read.getCommitment([testAddress]);
  console.log("Test bidder commitment:", commitment);
  console.log("Is zero:", commitment === "0x5fbdb2315678afecb367f032d93f642f64180aa3000000000000000000000000");
  
  console.log("\n=== Wallet Clients ===");
  console.log("Number of wallets:", walletClients.length);
  for (let i = 0; i < Math.min(3, walletClients.length); i++) {
    console.log(`Wallet ${i}:`, walletClients[i].account.address);
  }
}

main().catch(console.error);
