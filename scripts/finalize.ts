import hre from "hardhat";
import { formatEther } from "viem";
import fs from "fs";
import path from "path";

interface Bid {
  bidderIndex: number;
  address: string;
  bidAmount: string;
  secret: string;
  commitment: string;
}

const AUCTION_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
const BIDS_FILE = path.join(process.cwd(), ".auction-bids.json");

function loadBids(): Bid[] {
  if (fs.existsSync(BIDS_FILE)) {
    return JSON.parse(fs.readFileSync(BIDS_FILE, "utf-8"));
  }
  return [];
}

async function main(): Promise<void> {
  console.log("=== Sealed Bid Auction - Finalization ===\n");
  console.log(`Auction Address: ${AUCTION_ADDRESS}\n`);

  const { viem } = await hre.network.connect();
  const [walletClient] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const auction = await viem.getContractAt("SealedBidAuction", AUCTION_ADDRESS);

  const revealEndTime = await auction.read.revealEndTime();
  const currentBlock = await publicClient.getBlock();

  console.log(`Current Time: ${Number(currentBlock.timestamp)}`);
  console.log(`Reveal Phase Ends: ${Number(revealEndTime)}`);

  if (currentBlock.timestamp < revealEndTime) {
    console.log("\nERROR: Reveal phase has not ended yet!");
    const waitTime = Number(revealEndTime - currentBlock.timestamp);
    console.log(`Wait ${waitTime} seconds more`);
    process.exit(1);
  }

  const isFinalized = await auction.read.finalized();
  if (isFinalized) {
    console.log("\nAuction has already been finalized.\n");

    const winner = await auction.read.winner();
    const highestBid = await auction.read.highestBid();

    console.log("=".repeat(50));
    console.log("AUCTION RESULTS");
    console.log("=".repeat(50));
    console.log(`Winner: ${winner}`);
    console.log(`Highest Bid: ${formatEther(highestBid)} ETH`);
    console.log("=".repeat(50));
    return;
  }

  console.log("\nFinalizing auction...");
  const hash = await auction.write.finalizeAuction({
    account: walletClient.account,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Transaction included in block ${receipt.blockNumber}`);

  const winner = await auction.read.winner();
  const highestBid = await auction.read.highestBid();

  console.log("\n" + "=".repeat(50));
  console.log("         AUCTION RESULTS");
  console.log("=".repeat(50));
  console.log(`Winner: ${winner}`);
  console.log(`Highest Bid: ${formatEther(highestBid)} ETH`);
  console.log("=".repeat(50));

  const bids = loadBids();
  if (bids.length > 0) {
    console.log("\nBid Summary:");
    console.log("-".repeat(50));
    for (const bid of bids) {
      const isWinner = bid.address.toLowerCase() === winner.toLowerCase();
      console.log(`${bid.address.slice(0, 10)}... - ${formatEther(BigInt(bid.bidAmount))} ETH ${isWinner ? " [WINNER]" : ""}`);
    }
    console.log("-".repeat(50));
  }

  const auctioneer = await auction.read.owner();
  console.log(`\nAuctioneer: ${auctioneer}`);
  console.log("\nAuctioneer should collect payment from the winner.");
}

main().catch((error) => {
  console.error("Error during finalization:", error);
  process.exit(1);
});
