// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice Minimal interface for Semaphore v4.
 *         Full source: https://github.com/semaphore-protocol/semaphore (v4.x branch)
 *
 * SemaphoreProof field semantics:
 *   merkleTreeDepth  Depth of the group's Merkle tree (determines circuit size).
 *   merkleTreeRoot   Current root of the group's identity-commitment tree.
 *   nullifier        hash(identity_secret, scope) — opaque, reveals nothing.
 *   message          Application-defined signal. PragueExplorer uses
 *                    keccak256(displayName) >> 8 to bind the display name to
 *                    the proof and prevent front-running.
 *   scope            Application-defined domain separator. PragueExplorer sets
 *                    scope = cacheId so nullifiers from different caches cannot
 *                    be correlated even by this contract.
 *   points           Groth16 proof: [a.x, a.y, b.x0, b.x1, b.y0, b.y1, c.x, c.y]
 */
interface ISemaphore {
    struct SemaphoreProof {
        uint256 merkleTreeDepth;
        uint256 merkleTreeRoot;
        uint256 nullifier;
        uint256 message;
        uint256 scope;
        uint256[8] points;
    }

    error Semaphore__GroupDoesNotExist();
    error Semaphore__YouAreUsingTheSameNullifier();
    error Semaphore__InvalidProof();
    error Semaphore__CallerIsNotTheGroupAdmin();

    event GroupCreated(uint256 indexed groupId);
    event MemberAdded(
        uint256 indexed groupId,
        uint256 index,
        uint256 identityCommitment,
        uint256 merkleTreeRoot
    );
    event ProofValidated(
        uint256 indexed groupId,
        uint256 indexed merkleTreeDepth,
        uint256 indexed merkleTreeRoot,
        uint256 nullifier,
        uint256 message,
        uint256 scope,
        uint256[8] points
    );

    /// @notice Create a group administered by the caller.
    function createGroup() external returns (uint256 groupId);

    /// @notice Create a group with a specified admin.
    function createGroup(address admin) external returns (uint256 groupId);

    /// @notice Add an identity commitment to the group (admin only).
    function addMember(uint256 groupId, uint256 identityCommitment) external;

    /**
     * @notice Verify and consume a proof. Reverts on invalid proof or replayed nullifier.
     *         Only callable by the group admin. Marks the nullifier as used inside
     *         the Semaphore contract (primary nullifier tracking).
     */
    function validateProof(uint256 groupId, SemaphoreProof calldata proof) external;

    /// @notice Pure proof verification — does NOT consume the nullifier.
    function verifyProof(uint256 groupId, SemaphoreProof calldata proof)
        external
        view
        returns (bool);
}
