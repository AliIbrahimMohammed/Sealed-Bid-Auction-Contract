// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SealedBidAuction
 * @notice A sealed-bid auction contract using the commit-reveal scheme.
 * @dev Optimized for production deployment with minimal bytecode size.
 * 
 * How the Commit-Reveal Scheme Works:
 * ------------------------------------
 * 1. COMMIT PHASE: Bidders submit a hash of their bid amount and secret.
 *    - The commitment is keccak256(abi.encodePacked(bidAmount, secret))
 *    - Only the hash is visible on-chain; the actual bid remains secret
 *    - Prevents front-running and bid manipulation
 * 
 * 2. REVEAL PHASE: Bidders reveal their actual bid by providing the
 *    original amount and secret.
 *    - Contract verifies the commitment matches the revealed values
 *    - Invalid reveals are rejected
 * 
 * 3. FINALIZATION: The highest valid bid wins the auction.
 * 
 * Security Properties:
 * - Front-running Prevention: Bids cannot be seen before commit phase ends
 * - Bid Manipulation Prevention: Cannot change bid after commit
 * - Commitment Binding: Must reveal exactly what was committed
 * 
 * Off-chain Commitment Generation:
 * --------------------------------
 * The commitment is generated using:
 *   keccak256(abi.encodePacked(bidAmount, secret))
 * 
 * Example (TypeScript/viem):
 *   const commitment = keccak256(
 *     encodePacked(["uint256", "string"], [bidAmount, secret])
 *   );
 */
contract SealedBidAuction is Ownable, ReentrancyGuard {
    uint256 public immutable commitEndTime;
    uint256 public immutable revealEndTime;

    mapping(address => bytes32) private _commitments;
    mapping(address => uint256) private _revealedBids;
    
    address public winner;
    uint256 public highestBid;
    bool public finalized;
    
    address[] private _biddersList;
    mapping(address => bool) private _bidderInList;
    
    event BidCommitted(address indexed bidder, bytes32 commitment);
    event BidRevealed(address indexed bidder, uint256 amount);
    event AuctionFinalized(address indexed winner, uint256 highestBid);
    event BidRefunded(address indexed bidder, uint256 amount);
    
    error AuctionAlreadyFinalized();
    error BidderAlreadyCommitted();
    error BidderAlreadyRevealed();
    error CommitmentMismatch();
    error CommitPhaseEnded();
    error CommitPhaseNotEnded();
    error InvalidCommitment();
    error NoCommitmentFound();
    error NoBidToRefund();
    error RevealPhaseNotActive();
    error RevealPhaseNotEnded();
    error Unauthorized();

    constructor(
        uint256 commitDuration,
        uint256 revealDuration,
        address initialOwner
    ) Ownable(initialOwner) {
        commitEndTime = block.timestamp + commitDuration;
        revealEndTime = commitEndTime + revealDuration;
    }
    
    function commitBid(bytes32 commitment) 
        external 
        onlyDuringCommitPhase 
    {
        if (commitment == bytes32(0)) revert InvalidCommitment();
        if (_commitments[msg.sender] != bytes32(0)) revert BidderAlreadyCommitted();
        
        _commitments[msg.sender] = commitment;
        
        if (!_bidderInList[msg.sender]) {
            _bidderInList[msg.sender] = true;
            _biddersList.push(msg.sender);
        }
        
        emit BidCommitted(msg.sender, commitment);
    }
    
    function revealBid(uint256 bidAmount, string calldata secret) 
        external 
        onlyDuringRevealPhase 
        nonReentrant 
    {
        bytes32 commitment = _commitments[msg.sender];
        if (commitment == bytes32(0)) revert NoCommitmentFound();
        if (_revealedBids[msg.sender] != 0) revert BidderAlreadyRevealed();
        
        bytes32 computed = keccak256(abi.encodePacked(bidAmount, secret));
        if (computed != commitment) revert CommitmentMismatch();
        
        _revealedBids[msg.sender] = bidAmount;
        
        emit BidRevealed(msg.sender, bidAmount);
    }
    
    function finalizeAuction() 
        external 
        onlyAfterRevealPhase 
        nonReentrant 
    {
        if (finalized) revert AuctionAlreadyFinalized();
        
        if (msg.sender != owner() && _revealedBids[msg.sender] == 0) {
            revert Unauthorized();
        }
        
        address highestBidder = address(0);
        uint256 highest = 0;
        
        for (uint256 i = 0; i < _biddersList.length; i++) {
            if (_revealedBids[_biddersList[i]] > highest) {
                highest = _revealedBids[_biddersList[i]];
                highestBidder = _biddersList[i];
            }
        }
        
        winner = highestBidder;
        highestBid = highest;
        finalized = true;
        
        emit AuctionFinalized(winner, highestBid);
    }
    
    function claimRefund() 
        external 
        nonReentrant 
    {
        if (!finalized) revert AuctionAlreadyFinalized();
        if (msg.sender == winner) revert Unauthorized();
        
        uint256 bidAmount = _revealedBids[msg.sender];
        if (bidAmount == 0) revert NoBidToRefund();
        
        _revealedBids[msg.sender] = 0;
        
        emit BidRefunded(msg.sender, bidAmount);
    }
    
    function withdraw() 
        external 
        onlyOwner 
        nonReentrant 
    {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
    
    function getCommitment(address bidder) external view returns (bytes32) {
        return _commitments[bidder];
    }
    
    function getRevealedBid(address bidder) external view returns (uint256) {
        return _revealedBids[bidder];
    }
    
    function getAllBidders() external view returns (address[] memory) {
        return _biddersList;
    }
    
    function hasCommitted(address bidder) external view returns (bool) {
        return _commitments[bidder] != bytes32(0);
    }
    
    function hasRevealed(address bidder) external view returns (bool) {
        return _revealedBids[bidder] != 0;
    }
    
    modifier onlyDuringCommitPhase() {
        if (block.timestamp > commitEndTime) revert CommitPhaseEnded();
        _;
    }
    
    modifier onlyDuringRevealPhase() {
        if (block.timestamp < commitEndTime) revert CommitPhaseNotEnded();
        if (block.timestamp > revealEndTime) revert RevealPhaseNotActive();
        _;
    }
    
    modifier onlyAfterRevealPhase() {
        if (block.timestamp <= revealEndTime) revert RevealPhaseNotEnded();
        _;
    }
    
    receive() external payable {}
}
