import hre from "hardhat";
import { formatEther } from "viem";
import fs from "fs";
import path from "path";

const BIDS_FILE = path.join(process.cwd(), ".auction-bids.json");
const AUCTION_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

function loadBids() {
  if (fs.existsSync(BIDS_FILE)) {
    return JSON.parse(fs.readFileSync(BIDS_FILE, "utf-8"));
  }
  return [];
}

async function main() {
  console.log("=== Sealed Bid Auction - Reveal Phase ===\n");

  console.log(`Auction Contract: ${AUCTION_ADDRESS}\n`);

  const { viem } = await hre.network.connect();
  const walletClients = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const auction = await viem.getContractAt("SealedBidAuction", AUCTION_ADDRESS);

  const bids = loadBids();

  if (bids.length === 0) {
    console.log("Error: No bids found. Run commit.ts first.");
    return;
  }

  const [revealEndTime, currentBlock] = await Promise.all([
    auction.read.revealEndTime(),
    publicClient.getBlock(),
  ]);

  console.log(`Current Time: ${Number(currentBlock.timestamp)}`);
  console.log(`Reveal Phase Ends: ${Number(revealEndTime)}`);

  console.log(`\nRevealing ${bids.length} bids...\n`);

  for (let i = 0; i < bids.length; i++) {
    const bid = bids[i];
    const wallet = walletClients[i + 1];
    const bidAmount = BigInt(bid.bidAmount);

    console.log(`Bidder ${i + 1}:`);
    console.log(`  Address: ${bid.address}`);
    console.log(`  Bid Amount: ${formatEther(bidAmount)} ETH`);
    console.log(`  Secret: ${bid.secret}`);

    try {
      const hash = await auction.write.revealBid([bidAmount, bid.secret], {
        account: wallet.account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  Revealed in block: ${receipt.blockNumber}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`  Error: ${errorMessage}`);
    }

    console.log("");
  }

  console.log("========================================");
  console.log("Reveal Phase Complete!");
  console.log("========================================");
  console.log("\nNext steps:");
  console.log("  1. Wait for reveal phase to end");
  console.log("  2. Run: npx hardhat run scripts/finalize.ts --network localhost");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
