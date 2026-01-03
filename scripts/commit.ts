import hre from "hardhat";
import { keccak256, encodePacked, parseEther, formatEther } from "viem";
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
const NUM_BIDDERS = 10;

function saveBids(bids: Bid[]): void {
  fs.writeFileSync(BIDS_FILE, JSON.stringify(bids, null, 2));
}

function generateSecret(index: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "secret-";
  for (let i = 0; i < 16; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret + `-${index}`;
}

async function main(): Promise<void> {
  console.log("=== Sealed Bid Auction - Commit Phase ===\n");
  console.log(`Auction Contract: ${AUCTION_ADDRESS}`);
  console.log(`Number of Bidders: ${NUM_BIDDERS}\n`);

  const { viem } = await hre.network.connect();
  const walletClients = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  if (walletClients.length < NUM_BIDDERS + 1) {
    console.log(`Error: Need ${NUM_BIDDERS + 1} wallet clients, have ${walletClients.length}`);
    return;
  }

  const auction = await viem.getContractAt("SealedBidAuction", AUCTION_ADDRESS);

  const bidders = walletClients.slice(1, NUM_BIDDERS + 1);
  const bids: Bid[] = [];

  console.log(`Committing ${bidders.length} bids to the auction contract...\n`);

  for (let i = 0; i < bidders.length; i++) {
    const wallet = bidders[i];
    const bidAmount = parseEther((i + 1).toString());
    const secret = generateSecret(i);

    const commitment = keccak256(
      encodePacked(["uint256", "string"], [bidAmount, secret])
    ) as `0x${string}`;

    console.log(`Bidder ${i + 1}:`);
    console.log(`  Address: ${wallet.account.address}`);
    console.log(`  Bid Amount: ${formatEther(bidAmount)} ETH`);
    console.log(`  Secret: ${secret}`);
    console.log(`  Commitment: ${commitment.slice(0, 30)}...`);

    const hash = await auction.write.commitBid([commitment], {
      account: wallet.account,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  Tx Hash: ${hash}`);
    console.log(`  Block: ${receipt.blockNumber}\n`);

    bids.push({
      bidderIndex: i,
      address: wallet.account.address,
      bidAmount: bidAmount.toString(),
      secret,
      commitment,
    });
  }

  saveBids(bids);

  console.log("========================================");
  console.log("Commit Phase Complete!");
  console.log("========================================");
  console.log(`Total bids: ${bids.length}`);
  console.log("\nSummary:");
  for (const bid of bids) {
    console.log(`  ${bid.address.slice(0, 15)}... -> ${formatEther(BigInt(bid.bidAmount))} ETH`);
  }
  console.log("\nNext steps:");
  console.log("  1. Wait for commit phase to end");
  console.log("  2. Run: npx hardhat run scripts/reveal.ts --network localhost");
  console.log("  3. Wait for reveal phase to end");
  console.log("  4. Run: npx hardhat run scripts/finalize.ts --network localhost");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
