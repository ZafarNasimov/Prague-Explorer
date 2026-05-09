// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice Minimal EAS (Ethereum Attestation Service) interface.
 *         Full source: https://github.com/ethereum-attestation-service/eas-contracts
 *
 * Verified Scroll Sepolia addresses (source: github.com/ethereum-attestation-service/eas-contracts/deployments/scroll-sepolia, 2026-05-08):
 *   EAS:            0xaEF4103A04090071165F78D45D83A0C0782c2B2a
 *   SchemaRegistry: 0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797
 */
interface IEAS {
    struct AttestationRequestData {
        address recipient;       // attestation holder (msg.sender in PragueExplorer)
        uint64 expirationTime;   // 0 = no expiry
        bool revocable;
        bytes32 refUID;          // bytes32(0) = no reference
        bytes data;              // ABI-encoded attestation payload
        uint256 value;           // ETH forwarded (0 for us)
    }

    struct AttestationRequest {
        bytes32 schema;          // schema UID returned by SchemaRegistry.register()
        AttestationRequestData data;
    }

    function attest(AttestationRequest calldata request)
        external
        payable
        returns (bytes32 uid);
}

interface ISchemaRegistry {
    /**
     * @notice Register a new attestation schema.
     * @param schema     Human-readable field list, e.g. "uint256 cacheId,string displayName"
     * @param resolver   Address(0) = no on-chain resolver
     * @param revocable  Whether attestations under this schema can be revoked
     * @return UID       bytes32 schema identifier — store in PragueExplorer.attestationSchemaUID
     */
    function register(string calldata schema, address resolver, bool revocable)
        external
        returns (bytes32 UID);
}
