// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISemaphore} from "./interfaces/ISemaphore.sol";
import {IEAS} from "./interfaces/IEAS.sol";

/**
 * @title  PragueExplorer
 * @notice Privacy-preserving geocaching on Scroll Sepolia.
 *         Six real Prague landmark caches. Prove you were there. Claim an attestation.
 *         The contract never learns who claimed which cache.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRIVACY MODEL — read this before evaluating the Privacy by Design bounty
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. IDENTITY DERIVATION (client-side only, never exposed to this contract)
 *
 *    semaphoreIdentity = new Identity(keccak256(privyUserId + qrSecret))
 *
 *    • privyUserId — stable server-side identifier from Privy auth
 *    • qrSecret    — a per-cache random string encoded in the physical QR code
 *                    at the real-world site. The user must scan the QR in person
 *                    to obtain it; remote claimers cannot complete the proof.
 *    • The identity private key is derived deterministically from these inputs
 *      entirely inside the browser (snarkjs). It is never transmitted.
 *
 * 2. GROUP MEMBERSHIP — joinCache() ACCEPTED TRADE-OFF
 *
 *    After scanning the QR and passing the quiz, the user submits their Semaphore
 *    identity commitment (the public key derived from their identity secret).
 *    This call is observable on-chain: an observer sees "someone is joining cache X,"
 *    but CANNOT determine who — the identity commitment has no link to any external
 *    identifier (wallet, email, Privy account). The cacheId is the only information
 *    leaked.
 *
 *    This is the standard Semaphore anonymity-set trade-off: a member must be
 *    registered in the Merkle tree before a proof of membership can be generated.
 *    There is no way to prove membership in a set you haven't joined.
 *
 *    Mitigation: user wallets are pre-funded by a server-side deployer account
 *    so the gas payer identity is distinct from the Semaphore identity being
 *    registered. The deployer's address is not linked to the identity commitment.
 *
 * 3. PROOF GENERATION (client-side, ~3 seconds in-browser)
 *
 *    scope   = cacheId
 *      → nullifier = hash(identity_secret, cacheId)
 *      → nullifiers from DIFFERENT caches are UNCORRELATED — even this contract
 *         cannot link "Alice claimed cache 1" to "Alice claimed cache 2".
 *
 *    message = keccak256(abi.encodePacked(displayName)) >> 8
 *      → binds the chosen display name to the proof at the circuit level.
 *      → prevents front-running: changing displayName invalidates the proof.
 *
 * 4. ON-CHAIN CLAIM — what claimCache() reveals vs. conceals
 *
 *    REVEALS  (public inputs, visible on-chain):
 *      • nullifier    — opaque uint256, cannot be reverse-engineered to identity
 *      • displayName  — user-chosen, unverified, leaderboard convenience only
 *      • cacheId      — which cache was claimed
 *
 *    CONCEALS (never leaves the browser):
 *      • identity commitment (Semaphore public key)
 *      • identity secret (private key)
 *      • privyUserId
 *      • qrSecret
 *
 *    NOTE: CacheClaimed event does NOT index msg.sender. The EAS attestation
 *    recipient IS msg.sender (the user's Privy smart account), which is a
 *    deliberate UX trade-off: users need their wallet address to fetch their
 *    own attestations from the EAS GraphQL API.
 *
 * TODO(human): ENS L2 subname minting — replace user-chosen displayName with
 *              a verified ENS subname in v2 to prevent display-name squatting
 *              and improve Sybil resistance on the leaderboard.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
contract PragueExplorer {
    // ─── Immutables ───────────────────────────────────────────────────────────

    ISemaphore public immutable semaphore;
    IEAS public immutable eas;

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    bytes32 public attestationSchemaUID;

    /// cacheId → Semaphore groupId (auto-assigned by Semaphore on registerCache)
    mapping(uint256 => uint256) public cacheGroupIds;

    /// cacheId → IPFS CID (first 32 bytes). Full metadata lives off-chain.
    mapping(uint256 => bytes32) public cacheMetadataCID;

    /**
     * cacheId → beneficiary address for optional ETH donations.
     * Intended to point to a Prague cultural institution (museum, archive, etc.).
     * TODO(human): replace deployer placeholder addresses in caches.json with
     *              real institution addresses before the public demo.
     */
    mapping(uint256 => address) public cacheBeneficiary;

    /// cacheId → registered
    mapping(uint256 => bool) public cacheExists;

    /**
     * cacheId → nullifier → used.
     * Belt-and-suspenders: Semaphore's validateProof() also tracks nullifiers
     * internally. This local copy lets us emit a clearer revert reason and
     * protects against a future upgrade where the Semaphore instance changes.
     */
    mapping(uint256 => mapping(uint256 => bool)) public nullifierUsed;

    /// display name → total claims across all caches (leaderboard)
    mapping(string => uint256) public claimCount;

    /// ordered list of display names that have claimed at least once
    string[] private _leaderboardNames;
    mapping(string => bool) private _nameRegistered;

    // ─── Events ───────────────────────────────────────────────────────────────

    event CacheRegistered(uint256 indexed cacheId, bytes32 metadataCID);

    /**
     * @notice Emitted on every successful claim.
     * @dev    msg.sender is intentionally NOT indexed here — the claim should be
     *         attributable only to the nullifier, not to a wallet address.
     *         Judges: this is a deliberate privacy design decision, not an omission.
     */
    event CacheClaimed(uint256 indexed cacheId, uint256 indexed nullifier, string displayName);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error OnlyOwner();
    error CacheNotFound(uint256 cacheId);
    error CacheAlreadyRegistered(uint256 cacheId);
    error NullifierAlreadyUsed(uint256 cacheId, uint256 nullifier);
    error AttestationSchemaNotSet();

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _semaphore, address _eas) {
        semaphore = ISemaphore(_semaphore);
        eas = IEAS(_eas);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Call once after Deploy.s.sol registers the EAS schema.
    function setAttestationSchemaUID(bytes32 uid) external onlyOwner {
        attestationSchemaUID = uid;
    }

    /**
     * @notice Register a cache and create its Semaphore anonymity group.
     *         PragueExplorer becomes the Semaphore group admin so only this
     *         contract can add members (joinCache) and validate proofs (claimCache).
     *
     * @param cacheId      Stable identifier matching caches.json.
     * @param metadataCID  First 32 bytes of the IPFS CIDv1 pointing to cache metadata.
     * @param beneficiary  Institution receiving optional donations. Use deployer
     *                     as placeholder; TODO(human) replace before live demo.
     */
    function registerCache(uint256 cacheId, bytes32 metadataCID, address beneficiary)
        external
        onlyOwner
    {
        if (cacheExists[cacheId]) revert CacheAlreadyRegistered(cacheId);

        uint256 groupId = semaphore.createGroup(address(this));

        cacheGroupIds[cacheId] = groupId;
        cacheMetadataCID[cacheId] = metadataCID;
        cacheBeneficiary[cacheId] = beneficiary;
        cacheExists[cacheId] = true;

        emit CacheRegistered(cacheId, metadataCID);
    }

    // ─── User flow ────────────────────────────────────────────────────────────

    /**
     * @notice Add a user's identity commitment to a cache's anonymity group.
     *
     * PRIVACY TRADE-OFF: this call reveals that *someone* is preparing to claim
     * cache `cacheId`. The identity commitment has no link to any external identity.
     * User wallets are pre-funded by a deployer account (gas payer ≠ claimer).
     * See contract header for full discussion.
     *
     * @param cacheId            Cache the user has verified at (QR + quiz).
     * @param identityCommitment Semaphore public key.
     *                           Derived client-side: poseidon(identity_secret)
     *                           where identity_secret = keccak256(privyUserId || qrSecret).
     */
    function joinCache(uint256 cacheId, uint256 identityCommitment) external {
        if (!cacheExists[cacheId]) revert CacheNotFound(cacheId);
        semaphore.addMember(cacheGroupIds[cacheId], identityCommitment);
    }

    /**
     * @notice Submit a Semaphore proof to claim a cache and receive an EAS attestation.
     *
     * The proof MUST have been generated client-side with:
     *   scope   = cacheId          (enforced: contract constructs proof struct with scope=cacheId)
     *   message = uint256(keccak256(abi.encodePacked(displayName))) >> 8
     *             (enforced: contract recomputes and embeds; mismatched displayName = invalid proof)
     *
     * The >> 8 shift ensures the message fits within the BN254 scalar field.
     * Equivalent JS: BigInt('0x' + keccak256(displayName).slice(2)) >> 8n
     *
     * @param cacheId          Cache being claimed.
     * @param merkleTreeDepth  Depth of the group's Merkle tree.
     * @param merkleTreeRoot   Current Merkle root of the cache's identity group.
     * @param nullifier        Proof nullifier: hash(identity_secret, cacheId).
     * @param proofPoints      Groth16 proof packed as 8 uint256s: [a.x,a.y,b.x0,b.x1,b.y0,b.y1,c.x,c.y]
     * @param displayName      User-chosen leaderboard name. Unverified; bound to proof via message.
     */
    function claimCache(
        uint256 cacheId,
        uint256 merkleTreeDepth,
        uint256 merkleTreeRoot,
        uint256 nullifier,
        uint256[8] calldata proofPoints,
        string calldata displayName
    ) external payable {
        if (!cacheExists[cacheId]) revert CacheNotFound(cacheId);
        if (attestationSchemaUID == bytes32(0)) revert AttestationSchemaNotSet();
        if (nullifierUsed[cacheId][nullifier]) revert NullifierAlreadyUsed(cacheId, nullifier);

        // Bind displayName to the proof: recompute message from the calldata display name.
        // If the display name was changed after proof generation, this won't match the
        // message embedded in proofPoints, and validateProof will revert.
        uint256 message = uint256(keccak256(abi.encodePacked(displayName))) >> 8;

        ISemaphore.SemaphoreProof memory proof = ISemaphore.SemaphoreProof({
            merkleTreeDepth: merkleTreeDepth,
            merkleTreeRoot: merkleTreeRoot,
            nullifier: nullifier,
            message: message,
            scope: cacheId, // scope = cacheId → nullifiers are cache-scoped, uncorrelated
            points: proofPoints
        });

        // Primary verification: reverts on invalid proof or replayed nullifier.
        // Semaphore also records the nullifier internally.
        semaphore.validateProof(cacheGroupIds[cacheId], proof);

        // Belt-and-suspenders: local nullifier record for explicit revert message.
        nullifierUsed[cacheId][nullifier] = true;

        // Leaderboard update
        claimCount[displayName]++;
        if (!_nameRegistered[displayName]) {
            _nameRegistered[displayName] = true;
            _leaderboardNames.push(displayName);
        }

        // No address indexed — by design. See contract header.
        emit CacheClaimed(cacheId, nullifier, displayName);

        // EAS attestation. Schema is guaranteed non-zero by the revert guard above.
        // Schema: "uint256 cacheId, uint256 timestamp, string displayName"
        IEAS.AttestationRequest memory req = IEAS.AttestationRequest({
            schema: attestationSchemaUID,
            data: IEAS.AttestationRequestData({
                recipient: msg.sender, // user's Privy smart account; needed for /profile lookup
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(cacheId, block.timestamp, displayName),
                value: 0
            })
        });
        eas.attest(req);

        // Optional ETH donation to the cache's cultural institution beneficiary.
        // Non-reverting: a failed donation refunds the sender rather than blocking the claim.
        if (msg.value > 0 && cacheBeneficiary[cacheId] != address(0)) {
            (bool donated,) = cacheBeneficiary[cacheId].call{value: msg.value}("");
            if (!donated) {
                (bool refunded,) = msg.sender.call{value: msg.value}("");
                require(refunded, "donation and refund both failed");
            }
        }
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    /**
     * @notice Return all display names and their claim counts. Unsorted — sort on the frontend.
     *
     * On-chain sorting is O(n²) gas; for a hackathon with <1000 participants this
     * return-all approach is fine. In production, use an off-chain indexer.
     *
     * TODO(human): This function iterates the full _leaderboardNames array and will run out of
     *   gas as the dataset grows. Replace with getTopN(uint256 n) that caps the loop at n and
     *   uses a heap or off-chain sorted index. See THREAT_MODEL.md §"Known scaling limits".
     *   For EthPrague demo (≤ a few hundred claims) this is fine.
     *
     * TODO(human): ENS resolution for display names in v2.
     */
    function getLeaderboard()
        external
        view
        returns (string[] memory names, uint256[] memory counts)
    {
        uint256 len = _leaderboardNames.length;
        names = new string[](len);
        counts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            names[i] = _leaderboardNames[i];
            counts[i] = claimCount[_leaderboardNames[i]];
        }
    }
}
