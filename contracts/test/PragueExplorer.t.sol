// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PragueExplorer} from "../src/PragueExplorer.sol";
import {ISemaphore} from "../src/interfaces/ISemaphore.sol";
import {MockSemaphore} from "./helpers/MockSemaphore.sol";
import {MockEAS} from "./helpers/MockEAS.sol";

contract PragueExplorerTest is Test {
    PragueExplorer internal explorer;
    MockSemaphore internal semaphore;
    MockEAS internal eas;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant CACHE_1 = 1;
    uint256 internal constant CACHE_2 = 2;

    bytes32 internal constant METADATA_CID_1 = bytes32(uint256(1));
    bytes32 internal constant METADATA_CID_2 = bytes32(uint256(2));
    bytes32 internal constant SCHEMA_UID = keccak256("test-schema");

    // Dummy proof values — MockSemaphore accepts whatever we mark as valid
    uint256 internal constant NULLIFIER_A = 0xAAAA;
    uint256 internal constant NULLIFIER_B = 0xBBBB;
    uint256[8] internal ZERO_POINTS; // zero-filled, accepted by mock

    function setUp() public {
        semaphore = new MockSemaphore();
        eas = new MockEAS();

        vm.prank(owner);
        explorer = new PragueExplorer(address(semaphore), address(eas));

        vm.prank(owner);
        explorer.setAttestationSchemaUID(SCHEMA_UID);
    }

    // ─── registerCache ────────────────────────────────────────────────────────

    function test_registerCache_succeeds_asOwner() public {
        vm.prank(owner);
        explorer.registerCache(CACHE_1, METADATA_CID_1, address(0));

        assertTrue(explorer.cacheExists(CACHE_1));
        assertEq(explorer.cacheMetadataCID(CACHE_1), METADATA_CID_1);
    }

    function test_registerCache_reverts_asNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(PragueExplorer.OnlyOwner.selector);
        explorer.registerCache(CACHE_1, METADATA_CID_1, address(0));
    }

    function test_registerCache_reverts_onDuplicate() public {
        vm.startPrank(owner);
        explorer.registerCache(CACHE_1, METADATA_CID_1, address(0));
        vm.expectRevert(
            abi.encodeWithSelector(PragueExplorer.CacheAlreadyRegistered.selector, CACHE_1)
        );
        explorer.registerCache(CACHE_1, METADATA_CID_1, address(0));
        vm.stopPrank();
    }

    function test_registerCache_emitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit PragueExplorer.CacheRegistered(CACHE_1, METADATA_CID_1);
        explorer.registerCache(CACHE_1, METADATA_CID_1, address(0));
    }

    // ─── joinCache ────────────────────────────────────────────────────────────

    function test_joinCache_reverts_onUnknownCache() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(PragueExplorer.CacheNotFound.selector, 999)
        );
        explorer.joinCache(999, 0xDEAD);
    }

    function test_joinCache_addsMember() public {
        vm.prank(owner);
        explorer.registerCache(CACHE_1, METADATA_CID_1, address(0));

        uint256 groupId = explorer.cacheGroupIds(CACHE_1);

        vm.prank(alice);
        explorer.joinCache(CACHE_1, 0xDEAD);

        assertEq(semaphore.members(groupId, 0), 0xDEAD);
    }

    // ─── claimCache — successful path ─────────────────────────────────────────

    function test_claimCache_succeeds_withValidProof() public {
        _registerAndJoin(CACHE_1, alice, 0xDEAD);

        uint256 groupId = explorer.cacheGroupIds(CACHE_1);
        semaphore.markProofValid(groupId, NULLIFIER_A);

        vm.prank(alice);
        explorer.claimCache(CACHE_1, 20, 0, NULLIFIER_A, ZERO_POINTS, "Alice");

        assertTrue(explorer.nullifierUsed(CACHE_1, NULLIFIER_A));
        assertEq(explorer.claimCount("Alice"), 1);
    }

    function test_claimCache_emitsCacheClaimed() public {
        _registerAndJoin(CACHE_1, alice, 0xDEAD);

        uint256 groupId = explorer.cacheGroupIds(CACHE_1);
        semaphore.markProofValid(groupId, NULLIFIER_A);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit PragueExplorer.CacheClaimed(CACHE_1, NULLIFIER_A, "Alice");
        explorer.claimCache(CACHE_1, 20, 0, NULLIFIER_A, ZERO_POINTS, "Alice");
    }

    function test_claimCache_createsEASAttestation() public {
        _registerAndJoin(CACHE_1, alice, 0xDEAD);

        uint256 groupId = explorer.cacheGroupIds(CACHE_1);
        semaphore.markProofValid(groupId, NULLIFIER_A);

        vm.prank(alice);
        explorer.claimCache(CACHE_1, 20, 0, NULLIFIER_A, ZERO_POINTS, "Alice");

        assertEq(eas.attestationCount(), 1);
        (bytes32 schema, address recipient,) = eas.attestations(0);
        assertEq(schema, SCHEMA_UID);
        assertEq(recipient, alice);
    }

    /**
     * @notice claimCache must revert if the deployer forgot to call setAttestationSchemaUID.
     *         This catches the "no attestations on Scrollscan" footgun before it reaches prod.
     */
    function test_claimCache_reverts_onUnsetSchema() public {
        vm.prank(owner);
        PragueExplorer noSchema = new PragueExplorer(address(semaphore), address(eas));
        // attestationSchemaUID intentionally left as bytes32(0)

        vm.prank(owner);
        noSchema.registerCache(CACHE_1, METADATA_CID_1, address(0));

        uint256 groupId = noSchema.cacheGroupIds(CACHE_1);
        semaphore.markProofValid(groupId, NULLIFIER_A);

        vm.prank(alice);
        noSchema.joinCache(CACHE_1, 0xDEAD);

        vm.prank(alice);
        vm.expectRevert(PragueExplorer.AttestationSchemaNotSet.selector);
        noSchema.claimCache(CACHE_1, 20, 0, NULLIFIER_A, ZERO_POINTS, "Alice");
    }

    // ─── claimCache — nullifier replay ────────────────────────────────────────

    function test_claimCache_reverts_onReplayedNullifier() public {
        _registerAndJoin(CACHE_1, alice, 0xDEAD);

        uint256 groupId = explorer.cacheGroupIds(CACHE_1);
        semaphore.markProofValid(groupId, NULLIFIER_A);

        vm.prank(alice);
        explorer.claimCache(CACHE_1, 20, 0, NULLIFIER_A, ZERO_POINTS, "Alice");

        // Second claim with same nullifier should fail at our local check
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                PragueExplorer.NullifierAlreadyUsed.selector, CACHE_1, NULLIFIER_A
            )
        );
        explorer.claimCache(CACHE_1, 20, 0, NULLIFIER_A, ZERO_POINTS, "Alice");
    }

    // ─── claimCache — wrong cache / scope mismatch ────────────────────────────

    /**
     * @notice Simulates using a proof generated for cache 1 to claim cache 2.
     *         In production with a real Semaphore verifier, this fails because
     *         the Groth16 proof commits to scope=1 but we pass scope=2 (via cacheId).
     *
     *         In tests, the mock refuses because we only mark the proof valid for
     *         groupId of cache 1, not groupId of cache 2. This correctly models
     *         the scope-binding property of the ZK circuit.
     */
    function test_claimCache_reverts_onWrongScope() public {
        // Register both caches
        vm.startPrank(owner);
        explorer.registerCache(CACHE_1, METADATA_CID_1, address(0));
        explorer.registerCache(CACHE_2, METADATA_CID_2, address(0));
        vm.stopPrank();

        uint256 groupId1 = explorer.cacheGroupIds(CACHE_1);

        // Mark proof valid ONLY for cache 1's group; cache 2's group is not registered
        semaphore.markProofValid(groupId1, NULLIFIER_A);

        vm.prank(alice);
        explorer.joinCache(CACHE_1, 0xDEAD);
        vm.prank(alice);
        explorer.joinCache(CACHE_2, 0xDEAD);

        // Attempt to claim cache 2 using a proof that was valid for cache 1
        vm.prank(alice);
        vm.expectRevert(ISemaphore.Semaphore__InvalidProof.selector);
        explorer.claimCache(CACHE_2, 20, 0, NULLIFIER_A, ZERO_POINTS, "Alice");
    }

    // ─── claimCache — unknown cache ───────────────────────────────────────────

    function test_claimCache_reverts_onUnknownCache() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(PragueExplorer.CacheNotFound.selector, 999)
        );
        explorer.claimCache(999, 20, 0, NULLIFIER_A, ZERO_POINTS, "Alice");
    }

    // ─── Leaderboard ──────────────────────────────────────────────────────────

    function test_leaderboard_tracksMultipleClaims() public {
        vm.startPrank(owner);
        explorer.registerCache(CACHE_1, METADATA_CID_1, address(0));
        explorer.registerCache(CACHE_2, METADATA_CID_2, address(0));
        vm.stopPrank();

        uint256 g1 = explorer.cacheGroupIds(CACHE_1);
        uint256 g2 = explorer.cacheGroupIds(CACHE_2);

        semaphore.markProofValid(g1, NULLIFIER_A);
        semaphore.markProofValid(g2, NULLIFIER_B);

        vm.prank(alice);
        explorer.joinCache(CACHE_1, 0xAAAA);
        vm.prank(alice);
        explorer.claimCache(CACHE_1, 20, 0, NULLIFIER_A, ZERO_POINTS, "Alice");

        vm.prank(alice);
        explorer.joinCache(CACHE_2, 0xAAAA);
        vm.prank(alice);
        explorer.claimCache(CACHE_2, 20, 0, NULLIFIER_B, ZERO_POINTS, "Alice");

        (string[] memory names, uint256[] memory counts) = explorer.getLeaderboard();
        assertEq(names.length, 1);
        assertEq(names[0], "Alice");
        assertEq(counts[0], 2);
    }

    // ─── Donation ─────────────────────────────────────────────────────────────

    function test_claimCache_forwardsDonation_toBeneficiary() public {
        address beneficiary = makeAddr("museum");

        vm.prank(owner);
        explorer.registerCache(CACHE_1, METADATA_CID_1, beneficiary);

        uint256 groupId = explorer.cacheGroupIds(CACHE_1);
        semaphore.markProofValid(groupId, NULLIFIER_A);

        vm.prank(alice);
        explorer.joinCache(CACHE_1, 0xDEAD);

        uint256 donation = 0.01 ether;
        vm.deal(alice, donation);

        vm.prank(alice);
        explorer.claimCache{value: donation}(CACHE_1, 20, 0, NULLIFIER_A, ZERO_POINTS, "Alice");

        assertEq(beneficiary.balance, donation);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _registerAndJoin(uint256 cacheId, address user, uint256 commitment) internal {
        vm.prank(owner);
        explorer.registerCache(cacheId, bytes32(cacheId), address(0));

        vm.prank(user);
        explorer.joinCache(cacheId, commitment);
    }
}
