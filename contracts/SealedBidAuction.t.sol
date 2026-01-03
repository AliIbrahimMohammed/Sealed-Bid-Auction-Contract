// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test, console2 } from "forge-std/Test.sol";
import { SealedBidAuction } from "./SealedBidAuction.sol";

contract SealedBidAuctionTest is Test {
    SealedBidAuction public auction;
    
    address public auctioneer;
    address public bidder1;
    address public bidder2;
    address public bidder3;
    
    function setUp() public {
        auctioneer = makeAddr("auctioneer");
        bidder1 = makeAddr("bidder1");
        bidder2 = makeAddr("bidder2");
        bidder3 = makeAddr("bidder3");
        
        vm.prank(auctioneer);
        auction = new SealedBidAuction(7 days, 3 days, auctioneer);
    }
    
    function _computeCommitment(uint256 amount, string memory secret) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(amount, secret));
    }
    
    function testCommitBid() public {
        bytes32 commitment = _computeCommitment(1 ether, "secret1");
        
        vm.prank(bidder1);
        auction.commitBid(commitment);
        
        assertEq(auction.getCommitment(bidder1), commitment);
        assertTrue(auction.hasCommitted(bidder1));
    }
    
    function testCannotCommitTwice() public {
        bytes32 commitment = _computeCommitment(1 ether, "secret1");
        
        vm.prank(bidder1);
        auction.commitBid(commitment);
        
        vm.prank(bidder1);
        vm.expectRevert(abi.encodeWithSelector(SealedBidAuction.BidderAlreadyCommitted.selector));
        auction.commitBid(commitment);
    }
    
    function testCannotCommitZeroCommitment() public {
        vm.prank(bidder1);
        vm.expectRevert(abi.encodeWithSelector(SealedBidAuction.InvalidCommitment.selector));
        auction.commitBid(bytes32(0));
    }
    
    function testRevealBid() public {
        uint256 bidAmount = 2 ether;
        string memory secret = "mySecret";
        bytes32 commitment = _computeCommitment(bidAmount, secret);
        
        vm.prank(bidder1);
        auction.commitBid(commitment);
        
        vm.warp(7 days + 1);
        
        vm.prank(bidder1);
        auction.revealBid(bidAmount, secret);
        
        assertEq(auction.getRevealedBid(bidder1), bidAmount);
        assertTrue(auction.hasRevealed(bidder1));
    }
    
    function testCannotRevealWithWrongSecret() public {
        uint256 bidAmount = 2 ether;
        string memory secret = "mySecret";
        bytes32 commitment = _computeCommitment(bidAmount, secret);
        
        vm.prank(bidder1);
        auction.commitBid(commitment);
        
        vm.warp(7 days + 1);
        
        vm.prank(bidder1);
        vm.expectRevert(abi.encodeWithSelector(SealedBidAuction.CommitmentMismatch.selector));
        auction.revealBid(bidAmount, "wrongSecret");
    }
    
    function testCannotRevealWithoutCommitment() public {
        vm.warp(7 days + 1);
        
        vm.prank(bidder1);
        vm.expectRevert(abi.encodeWithSelector(SealedBidAuction.NoCommitmentFound.selector));
        auction.revealBid(1 ether, "secret");
    }
    
    function testCannotRevealTwice() public {
        uint256 bidAmount = 2 ether;
        string memory secret = "mySecret";
        bytes32 commitment = _computeCommitment(bidAmount, secret);
        
        vm.prank(bidder1);
        auction.commitBid(commitment);
        
        vm.warp(7 days + 1);
        
        vm.prank(bidder1);
        auction.revealBid(bidAmount, secret);
        
        vm.prank(bidder1);
        vm.expectRevert(abi.encodeWithSelector(SealedBidAuction.BidderAlreadyRevealed.selector));
        auction.revealBid(bidAmount, secret);
    }
    
    function testWinnerSelection() public {
        bytes32 commitment1 = _computeCommitment(1 ether, "secret1");
        bytes32 commitment2 = _computeCommitment(3 ether, "secret2");
        bytes32 commitment3 = _computeCommitment(2 ether, "secret3");
        
        vm.prank(bidder1);
        auction.commitBid(commitment1);
        
        vm.prank(bidder2);
        auction.commitBid(commitment2);
        
        vm.prank(bidder3);
        auction.commitBid(commitment3);
        
        vm.warp(7 days + 1);
        
        vm.prank(bidder1);
        auction.revealBid(1 ether, "secret1");
        
        vm.prank(bidder2);
        auction.revealBid(3 ether, "secret2");
        
        vm.prank(bidder3);
        auction.revealBid(2 ether, "secret3");
        
        vm.warp(10 days + 1);
        
        vm.prank(auctioneer);
        auction.finalizeAuction();
        
        assertEq(auction.winner(), bidder2);
        assertEq(auction.highestBid(), 3 ether);
    }
    
    function testCannotFinalizeBeforeRevealPhase() public {
        bytes32 commitment = _computeCommitment(1 ether, "secret");
        
        vm.prank(bidder1);
        auction.commitBid(commitment);
        
        vm.prank(auctioneer);
        vm.expectRevert(abi.encodeWithSelector(SealedBidAuction.RevealPhaseNotEnded.selector));
        auction.finalizeAuction();
    }
    
    function testCannotFinalizeTwice() public {
        bytes32 commitment = _computeCommitment(1 ether, "secret");
        
        vm.prank(bidder1);
        auction.commitBid(commitment);
        
        vm.warp(7 days + 1);
        
        vm.prank(bidder1);
        auction.revealBid(1 ether, "secret");
        
        vm.warp(10 days + 1);
        
        vm.prank(auctioneer);
        auction.finalizeAuction();
        
        vm.prank(auctioneer);
        vm.expectRevert(abi.encodeWithSelector(SealedBidAuction.AuctionAlreadyFinalized.selector));
        auction.finalizeAuction();
    }
    
    function testCannotCommitAfterCommitPhase() public {
        vm.warp(8 days);
        
        bytes32 commitment = _computeCommitment(1 ether, "secret");
        
        vm.prank(bidder1);
        vm.expectRevert(abi.encodeWithSelector(SealedBidAuction.CommitPhaseEnded.selector));
        auction.commitBid(commitment);
    }
    
    function testOnlyOwnerCanFinalize() public {
        bytes32 commitment = _computeCommitment(1 ether, "secret");
        
        vm.prank(bidder1);
        auction.commitBid(commitment);
        
        vm.warp(7 days + 1);
        
        vm.prank(bidder1);
        auction.revealBid(1 ether, "secret");
        
        vm.warp(10 days + 1);
        
        address random = makeAddr("random");
        vm.prank(random);
        vm.expectRevert(abi.encodeWithSelector(SealedBidAuction.Unauthorized.selector));
        auction.finalizeAuction();
    }
    
    function testGetAllBidders() public {
        bytes32 commitment1 = _computeCommitment(1 ether, "secret1");
        bytes32 commitment2 = _computeCommitment(2 ether, "secret2");
        
        vm.prank(bidder1);
        auction.commitBid(commitment1);
        
        vm.prank(bidder2);
        auction.commitBid(commitment2);
        
        address[] memory bidders = auction.getAllBidders();
        
        assertEq(bidders.length, 2);
        assertEq(bidders[0], bidder1);
        assertEq(bidders[1], bidder2);
    }
    
    function testEventEmission() public {
        bytes32 commitment = _computeCommitment(1 ether, "secret");
        
        vm.prank(bidder1);
        vm.expectEmit(true, true, true, true);
        emit SealedBidAuction.BidCommitted(bidder1, commitment);
        auction.commitBid(commitment);
    }
    
    function testMultipleBiddersWithSameBid() public {
        bytes32 commitment1 = _computeCommitment(5 ether, "secret1");
        bytes32 commitment2 = _computeCommitment(5 ether, "secret2");
        
        vm.prank(bidder1);
        auction.commitBid(commitment1);
        
        vm.prank(bidder2);
        auction.commitBid(commitment2);
        
        vm.warp(7 days + 1);
        
        vm.prank(bidder1);
        auction.revealBid(5 ether, "secret1");
        
        vm.prank(bidder2);
        auction.revealBid(5 ether, "secret2");
        
        vm.warp(10 days + 1);
        
        vm.prank(auctioneer);
        auction.finalizeAuction();
        
        assertTrue(auction.winner() == bidder1 || auction.winner() == bidder2);
        assertEq(auction.highestBid(), 5 ether);
    }
}
