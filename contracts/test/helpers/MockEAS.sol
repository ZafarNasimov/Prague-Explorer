// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEAS} from "../../src/interfaces/IEAS.sol";

/// @notice Minimal EAS mock — records attest() calls for assertions in tests.
contract MockEAS is IEAS {
    struct RecordedAttestation {
        bytes32 schema;
        address recipient;
        bytes data;
    }

    RecordedAttestation[] public attestations;

    function attest(AttestationRequest calldata request)
        external
        payable
        returns (bytes32 uid)
    {
        attestations.push(
            RecordedAttestation({
                schema: request.schema,
                recipient: request.data.recipient,
                data: request.data.data
            })
        );
        uid = keccak256(abi.encode(attestations.length, block.timestamp));
    }

    function attestationCount() external view returns (uint256) {
        return attestations.length;
    }
}
