// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISemaphore} from "../../src/interfaces/ISemaphore.sol";

/**
 * @notice Test double for the Semaphore contract.
 *         Mimics group creation, member addition, and proof validation
 *         without a real ZK verifier.
 *
 *         Proof validity is controlled by the test via markProofValid() —
 *         if a (groupId, nullifier) pair is not pre-registered as valid,
 *         validateProof reverts, simulating a bad or wrong-scope proof.
 */
contract MockSemaphore is ISemaphore {
    uint256 private _nextGroupId;

    /// groupId → admin
    mapping(uint256 => address) public groupAdmin;

    /// groupId → member commitments
    mapping(uint256 => uint256[]) public members;

    /// groupId → nullifier → used (replicated from real Semaphore)
    mapping(uint256 => mapping(uint256 => bool)) public nullifierUsed;

    /// groupId → nullifier → valid (test-controlled allowlist)
    mapping(uint256 => mapping(uint256 => bool)) private _validProofs;

    // ─── ISemaphore ───────────────────────────────────────────────────────────

    function createGroup() external returns (uint256 groupId) {
        groupId = _nextGroupId++;
        groupAdmin[groupId] = msg.sender;
        emit GroupCreated(groupId);
    }

    function createGroup(address admin) external returns (uint256 groupId) {
        groupId = _nextGroupId++;
        groupAdmin[groupId] = admin;
        emit GroupCreated(groupId);
    }

    function addMember(uint256 groupId, uint256 identityCommitment) external {
        members[groupId].push(identityCommitment);
        emit MemberAdded(groupId, members[groupId].length - 1, identityCommitment, 0);
    }

    function validateProof(uint256 groupId, SemaphoreProof calldata proof) external {
        if (msg.sender != groupAdmin[groupId]) revert Semaphore__CallerIsNotTheGroupAdmin();
        if (nullifierUsed[groupId][proof.nullifier]) revert Semaphore__YouAreUsingTheSameNullifier();
        if (!_validProofs[groupId][proof.nullifier]) revert Semaphore__InvalidProof();

        nullifierUsed[groupId][proof.nullifier] = true;
        emit ProofValidated(
            groupId,
            proof.merkleTreeDepth,
            proof.merkleTreeRoot,
            proof.nullifier,
            proof.message,
            proof.scope,
            proof.points
        );
    }

    function verifyProof(uint256 groupId, SemaphoreProof calldata proof)
        external
        view
        returns (bool)
    {
        return _validProofs[groupId][proof.nullifier] && !nullifierUsed[groupId][proof.nullifier];
    }

    // ─── Test helpers ─────────────────────────────────────────────────────────

    /// @notice Pre-register a (groupId, nullifier) pair as valid for the next validateProof call.
    function markProofValid(uint256 groupId, uint256 nullifier) external {
        _validProofs[groupId][nullifier] = true;
    }
}
