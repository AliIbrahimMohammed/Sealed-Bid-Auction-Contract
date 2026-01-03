#!/bin/bash

set -e

echo "=========================================="
echo "  Sealed Bid Auction - Full Pipeline"
echo "=========================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

NUM_BIDDERS=${1:-10}

echo "Configuration:"
echo "  - Number of bidders: $NUM_BIDDERS"
echo ""

step() {
    echo ""
    echo ">>> STEP: $1"
    echo ""
}

HARDHAT_PID=""

cleanup() {
    if [ -n "$HARDHAT_PID" ] && kill -0 "$HARDHAT_PID" 2>/dev/null; then
        kill "$HARDHAT_PID" 2>/dev/null || true
        wait "$HARDHAT_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

echo "=========================================="
echo "Step 0: Starting Hardhat Node"
echo "=========================================="
step "Starting Hardhat node..."
npx hardhat node --hostname 127.0.0.1 > /tmp/hardhat.log 2>&1 &
HARDHAT_PID=$!
sleep 5

if ! kill -0 "$HARDHAT_PID" 2>/dev/null; then
    echo "Error: Failed to start Hardhat node"
    cat /tmp/hardhat.log
    exit 1
fi
echo "Hardhat node started (PID: $HARDHAT_PID)"

echo ""
echo "=========================================="
echo "Step 1: Compiling Contracts"
echo "=========================================="
step "Compiling Solidity contracts..."
npx hardhat compile
echo "Compilation complete!"

echo ""
echo "=========================================="
echo "Step 2: Deploying Auction Contract"
echo "=========================================="
step "Deploying SealedBidAuction contract..."

rm -rf ignition/deployments/chain-31337
DEPLOY_OUTPUT=$(npx hardhat ignition deploy ./ignition/modules/SealedBidAuction.ts --network localhost --reset 2>&1)
echo "$DEPLOY_OUTPUT"

AUCTION_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oE '0x[a-fA-F0-9]{40}' | head -1)

if [ -z "$AUCTION_ADDRESS" ]; then
    echo "Error: Failed to get auction address"
    exit 1
fi

echo ""
echo "*** Contract deployed at: $AUCTION_ADDRESS ***"
echo "*** Updating scripts with new address... ***"

AUCTION_ADDRESS_LOWER=$(echo "$AUCTION_ADDRESS" | tr '[:upper:]' '[:lower:]')

cat > /tmp/update_address.js << 'EOF'
const fs = require('fs');
const path = require('path');

const newAddress = process.argv[2];
const scriptsDir = path.join(process.cwd(), 'scripts');

function updateFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.match(/0x[a-fA-F0-9]{40}/)) {
        const newContent = content.replace(/0x[a-fA-F0-9]{40}/g, newAddress);
        fs.writeFileSync(filePath, newContent);
        console.log('Updated:', filePath);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.ts')) {
            updateFile(fullPath);
        }
    }
}

walkDir(scriptsDir);
console.log('\nAll scripts updated with address:', newAddress);
EOF

node /tmp/update_address.js "$AUCTION_ADDRESS_LOWER"

echo ""
echo "=========================================="
echo "Step 3: Commit Phase - $NUM_BIDDERS Bidders"
echo "=========================================="
step "Committing bids..."

npx hardhat run scripts/commit.ts --network localhost
echo "All bids committed!"

echo ""
echo "=========================================="
echo "Step 4: Advance Time (Commit -> Reveal)"
echo "=========================================="
step "Advancing time past commit phase..."
npx hardhat run scripts/advance-time.ts --network localhost

echo ""
echo "=========================================="
echo "Step 5: Reveal Phase"
echo "=========================================="
step "Revealing bids..."
npx hardhat run scripts/reveal.ts --network localhost
echo "All bids revealed!"

echo ""
echo "=========================================="
echo "Step 6: Advance Time (Reveal -> Finalize)"
echo "=========================================="
step "Advancing time past reveal phase..."
npx hardhat run scripts/advance-time.ts --network localhost

echo ""
echo "=========================================="
echo "Step 7: Finalizing Auction"
echo "=========================================="
step "Finalizing auction and selecting winner..."
npx hardhat run scripts/finalize.ts --network localhost

echo ""
echo "=========================================="
echo "  Pipeline Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  - Contract: $AUCTION_ADDRESS"
echo "  - Bidders: $NUM_BIDDERS"
echo ""
