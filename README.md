# Sealed-Bid Auction Contract

A production-ready sealed-bid auction smart contract implementing the commit-reveal scheme on Ethereum. This project demonstrates a secure way to conduct auctions where bids remain hidden until the reveal phase, preventing front-running and bid manipulation.

## Table of Contents

- [Overview](#overview)
- [How the Commit-Reveal Scheme Works](#how-the-commit-reveal-scheme-works)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Detailed Usage Guide](#detailed-usage-guide)
- [Scripts Reference](#scripts-reference)
- [Test Results](#test-results)
- [Contract Details](#contract-details)
- [Security Considerations](#security-considerations)
- [License](#license)

## Overview

This auction system ensures bid privacy and fairness through cryptographic commitment:

- **Commit Phase**: Bidders submit a hash of their bid amount and secret
- **Reveal Phase**: Bidders reveal their actual bid by providing the amount and secret
- **Finalization**: The highest valid bid wins the auction

### Key Features

- Front-running prevention through cryptographic commitments
- Automatic refund handling for losing bidders
- Ownable contract with auctioneer control
- Reentrancy protection for all critical functions
- Full test coverage with Hardhat v3

## How the Commit-Reveal Scheme Works

### 1. Commit Phase

Bidders generate a commitment hash using:
```solidity
keccak256(abi.encodePacked(bidAmount, secret))
```

Only this hash is submitted on-chain. The actual bid amount and secret remain hidden.

### 2. Reveal Phase

Bidders reveal their bid by providing the original amount and secret. The contract:
- Verifies the commitment matches the revealed values
- Rejects invalid reveals (wrong amount or secret)
- Records the valid bid amount

### 3. Finalization

After the reveal phase ends, anyone can finalize the auction. The contract:
- Identifies the highest valid bid
- Declares the winner
- Allows losers to claim refunds

## Project Structure

```
Sealed-Bid Auction/
├── contracts/
│   ├── SealedBidAuction.sol      # Main contract
│   └── SealedBidAuction.t.sol    # Forge tests
├── scripts/
│   ├── commit.ts                 # Commit bids phase
│   ├── reveal.ts                 # Reveal bids phase
│   ├── finalize.ts               # Finalize auction
│   └── advance-time.ts           # Time manipulation for testing
├── test/
│   └── SealedBidAuction.ts       # Hardhat tests
├── ignition/
│   └── modules/
│       └── SealedBidAuction.ts   # Deployment module
├── hardhat.config.ts             # Hardhat configuration
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Hardhat v3

### Installation

```bash
npm install
```

### Run Complete Auction Demo

```bash
# 1. Start Hardhat node
npx hardhat node &

# 2. Deploy contract
npx hardhat ignition deploy ./ignition/modules/SealedBidAuction.ts --network localhost --reset

# 3. Commit bids (10 bidders)
npx hardhat run scripts/commit.ts --network localhost

# 4. Advance time past commit phase
npx hardhat run scripts/advance-time.ts --network localhost

# 5. Reveal bids
npx hardhat run scripts/reveal.ts --network localhost

# 6. Advance time past reveal phase
npx hardhat run scripts/advance-time.ts --network localhost

# 7. Finalize auction
npx hardhat run scripts/finalize.ts --network localhost
```

## Detailed Usage Guide

### Starting the Network

```bash
# Start Hardhat node in background
npx hardhat node &
```

### Deploying the Contract

```bash
# Deploy with fresh state (--reset clears previous deployments)
npx hardhat ignition deploy ./ignition/modules/SealedBidAuction.ts --network localhost --reset
```

### Phase 1: Commit Bids

The commit script automatically:
- Uses 10 Hardhat network accounts (wallets 1-10)
- Generates random secrets for each bidder
- Creates commitments with bid amounts 1-10 ETH
- Saves all bid data to `.auction-bids.json`

```bash
npx hardhat run scripts/commit.ts --network localhost
```

### Phase 2: Advance Time (Commit → Reveal)

After all bids are committed, advance time past the commit phase:

```bash
npx hardhat run scripts/advance-time.ts --network localhost
```

### Phase 3: Reveal Bids

The reveal script:
- Loads committed bids from `.auction-bids.json`
- Reveals each bid using stored amounts and secrets
- Verifies commitments on-chain

```bash
npx hardhat run scripts/reveal.ts --network localhost
```

### Phase 4: Advance Time (Reveal → Finalize)

After all bids are revealed, advance time past the reveal phase:

```bash
npx hardhat run scripts/advance-time.ts --network localhost
```

### Phase 5: Finalize Auction

The finalize script:
- Identifies the highest bidder
- Declares the winner
- Displays complete auction results

```bash
npx hardhat run scripts/finalize.ts --network localhost
```

## Scripts Reference

### commit.ts

Commits bids from multiple bidders to the auction contract.

**Usage:**
```bash
npx hardhat run scripts/commit.ts --network localhost
```

**Features:**
- Uses accounts 1-10 from Hardhat network
- Bid amounts: 1, 2, 3, ..., 10 ETH
- Generates 16-character random secrets
- Saves bid data to `.auction-bids.json`

### reveal.ts

Reveals previously committed bids.

**Usage:**
```bash
npx hardhat run scripts/reveal.ts --network localhost
```

**Features:**
- Loads bid data from `.auction-bids.json`
- Calls `revealBid(bidAmount, secret)` for each bidder
- Displays reveal status and block numbers

### finalize.ts

Finalizes the auction and declares the winner.

**Usage:**
```bash
npx hardhat run scripts/finalize.ts --network localhost
```

**Features:**
- Displays current time vs reveal end time
- Shows auction results (winner, highest bid)
- Lists all bids with winner indication

### advance-time.ts

Advances blockchain time to the next phase.

**Usage:**
```bash
npx hardhat run scripts/advance-time.ts --network localhost
```

**Features:**
- Automatically advances to commit phase end
- Then advances to reveal phase end on subsequent runs

## Test Results

### Auction Run Summary

```
=== Sealed Bid Auction - Finalization ===

Auction Address: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

==================================================
         AUCTION RESULTS
==================================================
Winner: 0xBcd4042DE499D14e55001CcbB24a551F3b954096
Highest Bid: 10 ETH
==================================================

Bid Summary:
--------------------------------------------------
0x70997970... - 1 ETH 
0x3c44cddd... - 2 ETH 
0x90f79bf6... - 3 ETH 
0x15d34aaf... - 4 ETH 
0x9965507d... - 5 ETH 
0x976ea740... - 6 ETH 
0x14dc7996... - 7 ETH 
0x23618e81... - 8 ETH 
0xa0ee7a14... - 9 ETH 
0xbcd4042d... - 10 ETH  [WINNER]
--------------------------------------------------

Auctioneer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

Auctioneer should collect payment from the winner.
```

### Transaction Summary

| Phase | Blocks | Transactions |
|-------|--------|--------------|
| Deploy | 1-3 | 1 (deployment) |
| Commit | 4-13 | 10 (bid commitments) |
| Reveal | 15-24 | 10 (bid reveals) |
| Finalize | 26 | 1 (finalization) |

### Test Coverage

Run the full test suite:
```bash
npx hardhat test
```

Tests cover:
- Full auction lifecycle
- Bid commitment and verification
- Invalid commitment rejection
- Refund identification
- Multiple bidder scenarios
- Phase transition validation
- Edge cases (zero bids, large amounts)

## Contract Details

### Constructor Parameters

```solidity
constructor(
    uint256 commitDuration,    // Commit phase duration in seconds
    uint256 revealDuration,    // Reveal phase duration in seconds
    address initialOwner       // Auctioneer's address
)
```

### Public Functions

| Function | Description |
|----------|-------------|
| `commitBid(bytes32 commitment)` | Submit a bid commitment |
| `revealBid(uint256 bidAmount, string calldata secret)` | Reveal a bid |
| `finalizeAuction()` | Finalize and declare winner |
| `claimRefund()` | Claim refund for losing bidders |
| `withdraw()` | Auctioneer withdraws highest bid |

### View Functions

| Function | Description |
|----------|-------------|
| `commitEndTime()` | Unix timestamp when commit phase ends |
| `revealEndTime()` | Unix timestamp when reveal phase ends |
| `winner()` | Address of the winning bidder |
| `highestBid()` | Amount of the highest bid |
| `getCommitment(address bidder)` | Get stored commitment |
| `getRevealedBid(address bidder)` | Get revealed bid amount |

### Events

```solidity
event BidCommitted(address indexed bidder, bytes32 commitment);
event BidRevealed(address indexed bidder, uint256 amount);
event AuctionFinalized(address indexed winner, uint256 highestBid);
event BidRefunded(address indexed bidder, uint256 amount);
```

## Security Considerations

### Cryptographic Security

- **Commitment Binding**: Uses `keccak256(abi.encodePacked(bidAmount, secret))` to create unforgeable commitments
- **Secret Protection**: Secrets are never stored on-chain; only their hashes

### Access Control

- **Ownable**: Contract inherits from OpenZeppelin's Ownable
- **ReentrancyGuard**: All critical functions use reentrancy protection
- **Phase Modifiers**: Time-based access control for each auction phase

### Best Practices

1. **Use Strong Secrets**: Generate cryptographically random secrets
2. **Verify Off-chain**: Double-check commitment generation matches on-chain verification
3. **Timely Reveal**: Reveal bids early in the reveal phase to avoid missing the deadline
4. **Keep Records**: Save `.auction-bids.json` for audit purposes

### Potential Attacks Mitigated

- **Front-running**: Bids are hidden during commit phase
- **Bid Manipulation**: Cannot change bid after commitment
- **Reentrancy**: Protected by ReentrancyGuard
- **Zero-value Commitments**: Contract rejects empty commitments

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.
