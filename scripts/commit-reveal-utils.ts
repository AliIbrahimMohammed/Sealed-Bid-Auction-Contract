import { keccak256, toHex, encodePacked } from "viem";

export interface BidCommitment {
  bidAmount: bigint;
  secret: string;
  commitment: `0x${string}`;
}

export function generateCommitment(
  bidAmount: bigint,
  secret: string
): `0x${string}` {
  const commitment = keccak256(
    encodePacked(["uint256", "string"], [bidAmount, secret])
  );
  return commitment;
}

export function verifyCommitment(
  bidAmount: bigint,
  secret: string,
  commitment: `0x${string}`
): boolean {
  const computed = generateCommitment(bidAmount, secret);
  return computed === commitment;
}
