import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre from "hardhat";
import { keccak256, encodePacked } from "viem";

async function increaseTime(seconds: bigint) {
  const { viem } = await hre.network.connect();
  const testClient = await viem.getTestClient();
  const publicClient = await viem.getPublicClient();
  const currentBlock = await publicClient.getBlock();
  const targetTime = currentBlock.timestamp + seconds;
  await testClient.setNextBlockTimestamp({ timestamp: targetTime });
  await testClient.mine({ blocks: 1 });
}

describe("SealedBidAuction", async function () {
  describe("Full Auction Cycle", async function () {
    it("Should complete full cycle: deploy → commit → reveal → finalize", async function () {
      const { viem } = await hre.network.connect();
      const walletClients = await viem.getWalletClients();
      const publicClient = await viem.getPublicClient();
      const auctionOwner = walletClients[0];

      console.log("\n=== FULL AUCTION CYCLE TEST ===\n");

      console.log("1. Deploying auction contract (1 sec commit, 1 sec reveal)...");
      const auction = await viem.deployContract("SealedBidAuction", [
        1n,
        1n,
        auctionOwner.account.address,
      ]);
      console.log(`   Auction deployed at: ${auction.address}`);

      const bidders = walletClients.slice(1, 6);
      const bids = [
        { wallet: bidders[0], amount: 10n, secret: "secret-a" },
        { wallet: bidders[1], amount: 50n, secret: "secret-b" },
        { wallet: bidders[2], amount: 25n, secret: "secret-c" },
        { wallet: bidders[3], amount: 100n, secret: "secret-d" },
        { wallet: bidders[4], amount: 75n, secret: "secret-e" },
      ];

      console.log("\n2. Commit Phase - 5 bidders submitting hashed commitments...");
      for (const bid of bids) {
        const commitment = keccak256(
          encodePacked(["uint256", "string"], [bid.amount, bid.secret])
        ) as `0x${string}`;
        await auction.write.commitBid([commitment], { account: bid.wallet.account });
        console.log(`   ${bid.wallet.account.address.slice(0, 15)}... committed: ${bid.amount} ETH`);
      }

      console.log("\n3. Advancing time to end of commit phase...");
      await increaseTime(2n);

      console.log("\n4. Reveal Phase - Bidders revealing actual bids...");
      for (const bid of bids) {
        await auction.write.revealBid([bid.amount, bid.secret], { account: bid.wallet.account });
        console.log(`   ${bid.wallet.account.address.slice(0, 15)}... revealed: ${bid.amount} ETH`);
      }

      console.log("\n5. Advancing time to end of reveal phase...");
      await increaseTime(2n);

      console.log("\n6. Finalizing auction...");
      const tx = await auction.write.finalizeAuction({ account: auctionOwner.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`   Finalized in block: ${receipt.blockNumber}`);

      const winner = await auction.read.winner();
      const highestBid = await auction.read.highestBid();

      console.log("\n7. RESULTS:");
      console.log(`   Winner: ${winner}`);
      console.log(`   Highest Bid: ${highestBid.toString()} wei`);

      assert.equal(winner, bidders[3].account.address);
      assert.equal(highestBid, 100n);

      const allBidders = await auction.read.getAllBidders();
      assert.equal(allBidders.length, 5);

      console.log("\n   All 5 bidders committed and revealed!");
      console.log("   Winner correctly selected as highest bidder!");
      console.log("\n=== AUCTION CYCLE COMPLETE ===\n");
    });

    it("Should handle 10 bidders full cycle", async function () {
      const { viem } = await hre.network.connect();
      const walletClients = await viem.getWalletClients();
      const auctionOwner = walletClients[0];

      assert.ok(walletClients.length >= 11, "Need at least 11 wallet clients");

      console.log("\n=== 10-BIDDER FULL CYCLE TEST ===\n");

      const auction = await viem.deployContract("SealedBidAuction", [
        1n,
        1n,
        auctionOwner.account.address,
      ]);
      console.log(`Auction deployed at: ${auction.address}`);

      const bidders = walletClients.slice(1, 11);
      const bids = [
        { wallet: bidders[0], amount: 5n, secret: "s0" },
        { wallet: bidders[1], amount: 15n, secret: "s1" },
        { wallet: bidders[2], amount: 25n, secret: "s2" },
        { wallet: bidders[3], amount: 35n, secret: "s3" },
        { wallet: bidders[4], amount: 45n, secret: "s4" },
        { wallet: bidders[5], amount: 55n, secret: "s5" },
        { wallet: bidders[6], amount: 65n, secret: "s6" },
        { wallet: bidders[7], amount: 75n, secret: "s7" },
        { wallet: bidders[8], amount: 85n, secret: "s8" },
        { wallet: bidders[9], amount: 95n, secret: "s9" },
      ];

      console.log("\nCommit Phase (10 bidders):");
      for (const bid of bids) {
        const commitment = keccak256(
          encodePacked(["uint256", "string"], [bid.amount, bid.secret])
        ) as `0x${string}`;
        await auction.write.commitBid([commitment], { account: bid.wallet.account });
      }
      console.log("All 10 bids committed!");

      await increaseTime(2n);

      console.log("Reveal Phase:");
      for (const bid of bids) {
        await auction.write.revealBid([bid.amount, bid.secret], { account: bid.wallet.account });
      }
      console.log("All 10 bids revealed!");

      await increaseTime(2n);

      await auction.write.finalizeAuction();

      const winner = await auction.read.winner();
      const highestBid = await auction.read.highestBid();

      console.log("\n=== FINAL RESULTS ===");
      console.log(`Winner: ${winner}`);
      console.log(`Highest Bid: ${highestBid.toString()} wei`);
      console.log("=====================\n");

      assert.equal(winner, bidders[9].account.address);
      assert.equal(highestBid, 95n);
      console.log("10-bidder cycle test PASSED!\n");
    });

    it("Should identify non-winners for refund", async function () {
      const { viem } = await hre.network.connect();
      const walletClients = await viem.getWalletClients();
      const auctionOwner = walletClients[0];

      console.log("\n=== REFUND IDENTIFICATION TEST ===\n");

      const auction = await viem.deployContract("SealedBidAuction", [
        1n,
        1n,
        auctionOwner.account.address,
      ]);

      const highBidder = walletClients[1];
      const lowBidder = walletClients[2];

      const highAmount = 100n;
      const lowAmount = 10n;

      console.log("Committing bids...");
      const highCommitment = keccak256(
        encodePacked(["uint256", "string"], [highAmount, "high-s"])
      ) as `0x${string}`;
      const lowCommitment = keccak256(
        encodePacked(["uint256", "string"], [lowAmount, "low-s"])
      ) as `0x${string}`;

      await auction.write.commitBid([highCommitment], { account: highBidder.account });
      await auction.write.commitBid([lowCommitment], { account: lowBidder.account });

      await increaseTime(2n);

      console.log("Revealing bids...");
      await auction.write.revealBid([highAmount, "high-s"], { account: highBidder.account });
      await auction.write.revealBid([lowAmount, "low-s"], { account: lowBidder.account });

      await increaseTime(2n);

      await auction.write.finalizeAuction();

      const winner = await auction.read.winner();
      console.log(`\nWinner: ${winner}`);
      console.log(`High bidder is winner: ${winner.toLowerCase() === highBidder.account.address.toLowerCase()}`);

      assert.equal(winner.toLowerCase(), highBidder.account.address.toLowerCase());
      console.log("\nLow bidder should claim refund after auction ends.");
      console.log("Refund identification test PASSED!\n");
    });

    it("Should verify all bid amounts match after reveal", async function () {
      const { viem } = await hre.network.connect();
      const walletClients = await viem.getWalletClients();
      const auctionOwner = walletClients[0];

      console.log("\n=== BID VERIFICATION TEST ===\n");

      const auction = await viem.deployContract("SealedBidAuction", [
        1n,
        1n,
        auctionOwner.account.address,
      ]);

      const testCases = [
        { wallet: walletClients[1], amount: 1n, secret: "a" },
        { wallet: walletClients[2], amount: 1000000n, secret: "b" },
        { wallet: walletClients[3], amount: 123456789012345678n, secret: "c" },
      ];

      console.log("Committing bids...");
      for (const tc of testCases) {
        const commitment = keccak256(
          encodePacked(["uint256", "string"], [tc.amount, tc.secret])
        ) as `0x${string}`;
        await auction.write.commitBid([commitment], { account: tc.wallet.account });
      }

      await increaseTime(2n);

      console.log("Revealing and verifying...");
      for (const tc of testCases) {
        await auction.write.revealBid([tc.amount, tc.secret], { account: tc.wallet.account });
        const revealed = await auction.read.getRevealedBid([tc.wallet.account.address]);
        assert.equal(revealed, tc.amount, `Bid amount mismatch for ${tc.wallet.account.address}`);
        console.log(`   ${tc.wallet.account.address.slice(0, 15)}...: ${tc.amount} = ${revealed} ✓`);
      }

      console.log("\nAll bid amounts verified correctly!\n");
    });

    it("Should reject invalid reveals", async function () {
      const { viem } = await hre.network.connect();
      const [walletClient] = await viem.getWalletClients();

      console.log("\n=== INVALID REJECTION TEST ===\n");

      const auction = await viem.deployContract("SealedBidAuction", [
        1n,
        1n,
        walletClient.account.address,
      ]);

      const correctAmount = 100n;
      const correctSecret = "my-secret";
      const commitment = keccak256(
        encodePacked(["uint256", "string"], [correctAmount, correctSecret])
      ) as `0x${string}`;
      await auction.write.commitBid([commitment]);

      await increaseTime(2n);

      console.log("Testing wrong amount...");
      let errorThrown = false;
      try {
        await auction.write.revealBid([200n, correctSecret]);
      } catch (e) {
        errorThrown = true;
      }
      assert.ok(errorThrown, "Should reject wrong amount");
      console.log("   Wrong amount rejected ✓");

      console.log("Testing wrong secret...");
      errorThrown = false;
      try {
        await auction.write.revealBid([correctAmount, "wrong-secret"]);
      } catch (e) {
        errorThrown = true;
      }
      assert.ok(errorThrown, "Should reject wrong secret");
      console.log("   Wrong secret rejected ✓");

      console.log("Testing correct reveal...");
      await auction.write.revealBid([correctAmount, correctSecret]);
      const revealed = await auction.read.getRevealedBid([walletClient.account.address]);
      assert.equal(revealed, correctAmount);
      console.log("   Correct reveal accepted ✓\n");
    });
  });

  describe("Commit Phase", async function () {
    it("Should allow commits with long duration", async function () {
      const { viem } = await hre.network.connect();
      const walletClients = await viem.getWalletClients();
      const auctionOwner = walletClients[0];

      console.log("\n=== COMMIT PHASE TEST (7 days) ===\n");

      const auction = await viem.deployContract("SealedBidAuction", [
        7n * 24n * 60n * 60n,
        3n * 24n * 60n * 60n,
        auctionOwner.account.address,
      ]);
      console.log(`Auction deployed at: ${auction.address}`);

      const bidders = walletClients.slice(1, 6);
      console.log("\nCommit Phase:");
      for (let i = 0; i < bidders.length; i++) {
        const bidAmount = BigInt((i + 1) * 10);
        const secret = `secret-${i}`;
        const commitment = keccak256(
          encodePacked(["uint256", "string"], [bidAmount, secret])
        ) as `0x${string}`;
        await auction.write.commitBid([commitment], { account: bidders[i].account });
        console.log(`   Bidder ${i + 1}: committed ${bidAmount} ETH`);
      }

      const allBidders = await auction.read.getAllBidders();
      assert.equal(allBidders.length, 5);
      console.log("\n5 bids committed successfully!\n");
    });

    it("Should prevent double commitment", async function () {
      const { viem } = await hre.network.connect();
      const [walletClient] = await viem.getWalletClients();

      const auction = await viem.deployContract("SealedBidAuction", [
        7n * 24n * 60n * 60n,
        3n * 24n * 60n * 60n,
        walletClient.account.address,
      ]);

      const bidAmount = 50n;
      const secret = "unique-secret";
      const commitment = keccak256(
        encodePacked(["uint256", "string"], [bidAmount, secret])
      ) as `0x${string}`;

      await auction.write.commitBid([commitment]);

      let errorThrown = false;
      try {
        await auction.write.commitBid([commitment]);
      } catch (e) {
        errorThrown = true;
      }
      assert.ok(errorThrown, "Should prevent double commitment");
      console.log("Double commitment correctly prevented!\n");
    });

    it("Should track committed state correctly", async function () {
      const { viem } = await hre.network.connect();
      const [walletClient] = await viem.getWalletClients();

      const auction = await viem.deployContract("SealedBidAuction", [
        7n * 24n * 60n * 60n,
        3n * 24n * 60n * 60n,
        walletClient.account.address,
      ]);

      const bidAmount = 42n;
      const secret = "track-state-secret";
      const commitment = keccak256(
        encodePacked(["uint256", "string"], [bidAmount, secret])
      ) as `0x${string}`;

      const hasCommittedBefore = await auction.read.hasCommitted([walletClient.account.address]);
      assert.ok(!hasCommittedBefore);

      await auction.write.commitBid([commitment]);

      const hasCommittedAfter = await auction.read.hasCommitted([walletClient.account.address]);
      assert.ok(hasCommittedAfter);
      console.log("Committed state tracking works correctly!\n");
    });
  });

  describe("Reveal Phase", async function () {
    it("Should reveal bids correctly", async function () {
      const { viem } = await hre.network.connect();
      const [walletClient] = await viem.getWalletClients();

      const auction = await viem.deployContract("SealedBidAuction", [
        1n,
        60n * 60n,
        walletClient.account.address,
      ]);

      const bidAmount = 77n;
      const secret = "reveal-test-secret";
      const commitment = keccak256(
        encodePacked(["uint256", "string"], [bidAmount, secret])
      ) as `0x${string}`;

      await auction.write.commitBid([commitment]);
      await increaseTime(2n);
      await auction.write.revealBid([bidAmount, secret]);

      const revealedBid = await auction.read.getRevealedBid([walletClient.account.address]);
      assert.equal(revealedBid, bidAmount);

      const hasRevealed = await auction.read.hasRevealed([walletClient.account.address]);
      assert.ok(hasRevealed);
      console.log("Reveal phase works correctly!\n");
    });

    it("Should track all bidders correctly", async function () {
      const { viem } = await hre.network.connect();
      const walletClients = await viem.getWalletClients();
      const auctionOwner = walletClients[0];

      const auction = await viem.deployContract("SealedBidAuction", [
        1n,
        60n * 60n,
        auctionOwner.account.address,
      ]);

      const bidders = walletClients.slice(1, 6);
      const bids = [
        { wallet: bidders[0], amount: 10n, secret: "bidder1-secret" },
        { wallet: bidders[1], amount: 50n, secret: "bidder2-secret" },
        { wallet: bidders[2], amount: 25n, secret: "bidder3-secret" },
        { wallet: bidders[3], amount: 100n, secret: "bidder4-secret" },
        { wallet: bidders[4], amount: 75n, secret: "bidder5-secret" },
      ];

      for (const bid of bids) {
        const commitment = keccak256(
          encodePacked(["uint256", "string"], [bid.amount, bid.secret])
        ) as `0x${string}`;
        await auction.write.commitBid([commitment], { account: bid.wallet.account });
      }

      await increaseTime(2n);

      for (const bid of bids) {
        await auction.write.revealBid([bid.amount, bid.secret], { account: bid.wallet.account });
      }

      const allBidders = await auction.read.getAllBidders();
      assert.equal(allBidders.length, 5);

      for (const bid of bids) {
        const hasRevealed = await auction.read.hasRevealed([bid.wallet.account.address]);
        assert.ok(hasRevealed);
      }
      console.log("All bidders tracked correctly!\n");
    });
  });

  describe("Hash-Based Commit Scheme", async function () {
    it("Should generate correct hash commitment", async function () {
      const { viem } = await hre.network.connect();
      const [walletClient] = await viem.getWalletClients();

      const auction = await viem.deployContract("SealedBidAuction", [
        7n * 24n * 60n * 60n,
        3n * 24n * 60n * 60n,
        walletClient.account.address,
      ]);

      const bidAmount = 1n;
      const secret = "test-secret";

      const commitment = keccak256(
        encodePacked(["uint256", "string"], [bidAmount, secret])
      ) as `0x${string}`;

      await auction.write.commitBid([commitment]);

      const storedCommitment = await auction.read.getCommitment([
        walletClient.account.address,
      ]);

      assert.notEqual(storedCommitment, 0n);
      assert.equal(storedCommitment, commitment);
    });

    it("Should reject commitment with zero hash", async function () {
      const { viem } = await hre.network.connect();
      const [walletClient] = await viem.getWalletClients();

      const auction = await viem.deployContract("SealedBidAuction", [
        7n * 24n * 60n * 60n,
        3n * 24n * 60n * 60n,
        walletClient.account.address,
      ]);

      let errorThrown = false;
      try {
        await auction.write.commitBid(["0x0000000000000000000000000000000000000000000000000000000000000000"]);
      } catch (e) {
        errorThrown = true;
      }
      assert.ok(errorThrown);
    });

    it("Should handle different bid amounts and secrets", async function () {
      const { viem } = await hre.network.connect();
      const [walletClient, walletClient2, walletClient3] = await viem.getWalletClients();

      const auction = await viem.deployContract("SealedBidAuction", [
        7n * 24n * 60n * 60n,
        3n * 24n * 60n * 60n,
        walletClient.account.address,
      ]);

      const testCases = [
        { wallet: walletClient, bidAmount: 100n, secret: "secret-1" },
        { wallet: walletClient2, bidAmount: 1000n, secret: "another-secret" },
        { wallet: walletClient3, bidAmount: 1n, secret: "minimal-bid" },
      ];

      for (const testCase of testCases) {
        const commitment = keccak256(
          encodePacked(["uint256", "string"], [testCase.bidAmount, testCase.secret])
        ) as `0x${string}`;

        await auction.write.commitBid([commitment], {
          account: testCase.wallet.account
        });

        const storedCommitment = await auction.read.getCommitment([
          testCase.wallet.account.address,
        ]);

        assert.equal(storedCommitment, commitment);
      }
    });
  });

  describe("Edge Cases", async function () {
    it("Should handle zero bid", async function () {
      const { viem } = await hre.network.connect();
      const [walletClient] = await viem.getWalletClients();

      const auction = await viem.deployContract("SealedBidAuction", [
        7n * 24n * 60n * 60n,
        3n * 24n * 60n * 60n,
        walletClient.account.address,
      ]);

      const bidAmount = 0n;
      const secret = "zero-bid-secret";
      const commitment = keccak256(
        encodePacked(["uint256", "string"], [bidAmount, secret])
      ) as `0x${string}`;

      await auction.write.commitBid([commitment]);

      const storedCommitment = await auction.read.getCommitment([walletClient.account.address]);
      assert.equal(storedCommitment, commitment);
    });

    it("Should handle very large bid amounts", async function () {
      const { viem } = await hre.network.connect();
      const [walletClient] = await viem.getWalletClients();

      const auction = await viem.deployContract("SealedBidAuction", [
        7n * 24n * 60n * 60n,
        3n * 24n * 60n * 60n,
        walletClient.account.address,
      ]);

      const bidAmount = 1n << 100n;
      const secret = "large-bid-secret";
      const commitment = keccak256(
        encodePacked(["uint256", "string"], [bidAmount, secret])
      ) as `0x${string}`;

      await auction.write.commitBid([commitment]);

      const storedCommitment = await auction.read.getCommitment([walletClient.account.address]);
      assert.equal(storedCommitment, commitment);
    });

    it("Should handle long secret strings", async function () {
      const { viem } = await hre.network.connect();
      const [walletClient] = await viem.getWalletClients();

      const auction = await viem.deployContract("SealedBidAuction", [
        7n * 24n * 60n * 60n,
        3n * 24n * 60n * 60n,
        walletClient.account.address,
      ]);

      const bidAmount = 99n;
      const secret = "a".repeat(1000);
      const commitment = keccak256(
        encodePacked(["uint256", "string"], [bidAmount, secret])
      ) as `0x${string}`;

      await auction.write.commitBid([commitment]);

      const storedCommitment = await auction.read.getCommitment([walletClient.account.address]);
      assert.equal(storedCommitment, commitment);
    });
  });

  describe("10-Bidder Tests", async function () {
    it("Should commit 10 bids correctly", async function () {
      const { viem } = await hre.network.connect();
      const walletClients = await viem.getWalletClients();
      const auctionOwner = walletClients[0];

      assert.ok(walletClients.length >= 11, "Need at least 11 wallet clients");

      const auction = await viem.deployContract("SealedBidAuction", [
        7n * 24n * 60n * 60n,
        3n * 24n * 60n * 60n,
        auctionOwner.account.address,
      ]);

      const bidders = walletClients.slice(1, 11);
      const bids = [
        { wallet: bidders[0], amount: 10n, secret: "s0" },
        { wallet: bidders[1], amount: 20n, secret: "s1" },
        { wallet: bidders[2], amount: 30n, secret: "s2" },
        { wallet: bidders[3], amount: 40n, secret: "s3" },
        { wallet: bidders[4], amount: 50n, secret: "s4" },
        { wallet: bidders[5], amount: 60n, secret: "s5" },
        { wallet: bidders[6], amount: 70n, secret: "s6" },
        { wallet: bidders[7], amount: 80n, secret: "s7" },
        { wallet: bidders[8], amount: 90n, secret: "s8" },
        { wallet: bidders[9], amount: 100n, secret: "s9" },
      ];

      for (const bid of bids) {
        const commitment = keccak256(
          encodePacked(["uint256", "string"], [bid.amount, bid.secret])
        ) as `0x${string}`;
        await auction.write.commitBid([commitment], { account: bid.wallet.account });
      }

      const allBidders = await auction.read.getAllBidders();
      assert.equal(allBidders.length, 10);
      console.log("10 bids committed successfully!\n");
    });
  });
});
