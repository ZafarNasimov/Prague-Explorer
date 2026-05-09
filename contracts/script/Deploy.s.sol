// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PragueExplorer} from "../src/PragueExplorer.sol";
import {IEAS, ISchemaRegistry} from "../src/interfaces/IEAS.sol";

/*
 * Deploy — Foundry deployment script for PragueExplorer on Scroll Sepolia.
 *
 * PRE-REQUISITES
 * --------------
 * 1. Deploy a Semaphore v4 instance. The easiest way for Scroll Sepolia:
 *
 *      pnpm dlx @semaphore-protocol/cli@latest deploy --network scroll-sepolia
 *
 *    This outputs a SEMAPHORE_ADDRESS. Set it in .env:
 *      SEMAPHORE_ADDRESS=0x...
 *
 *    TODO(human): If the Semaphore CLI does not support scroll-sepolia,
 *    clone https://github.com/semaphore-protocol/semaphore, build the contracts,
 *    and deploy SemaphoreVerifier + Semaphore manually via a secondary forge script.
 *
 * 2. Confirm EAS contract addresses on Scroll Sepolia.
 *    Check: https://docs.attest.sh/docs/quick--start/contracts
 *    Set in .env:
 *      EAS_CONTRACT_ADDRESS=0x...
 *      EAS_SCHEMA_REGISTRY_ADDRESS=0x...
 *
 *    TODO(human): The addresses below are estimates — verify before live deploy.
 *
 * 3. Fill in DEPLOYER_PRIVATE_KEY and the Scroll Sepolia RPC in .env.
 *
 * RUN
 * ───
 *   source .env
 *   forge script script/Deploy.s.sol \
 *     --rpc-url scroll_sepolia \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * LOCAL DRY-RUN (anvil)
 * ─────────────────────
 *   anvil &
 *   forge script script/Deploy.s.sol --rpc-url anvil --broadcast -vvvv
 *   (Semaphore + EAS must be stubbed for local runs — see LocalDeploy.s.sol pattern)
 */
contract Deploy is Script {
    // ─── Scroll Sepolia constants ─────────────────────────────────────────────

    // Verified 2026-05-08 from https://github.com/ethereum-attestation-service/eas-contracts/tree/master/deployments/scroll-sepolia
    address internal constant EAS_SCROLL_SEPOLIA =
        0xaEF4103A04090071165F78D45D83A0C0782c2B2a;
    address internal constant EAS_SCHEMA_REGISTRY_SCROLL_SEPOLIA =
        0x55D26f9ae0203EF95494AE4C170eD35f4Cf77797;

    // EAS attestation schema — matches the payload encoded in claimCache()
    string internal constant ATTESTATION_SCHEMA =
        "uint256 cacheId,uint256 timestamp,string displayName";

    function run() external {
        // ── Load env ──────────────────────────────────────────────────────────
        address semaphoreAddress = vm.envAddress("SEMAPHORE_ADDRESS");
        address easAddress =
            vm.envOr("EAS_CONTRACT_ADDRESS", EAS_SCROLL_SEPOLIA);
        address schemaRegistryAddress =
            vm.envOr("EAS_SCHEMA_REGISTRY_ADDRESS", EAS_SCHEMA_REGISTRY_SCROLL_SEPOLIA);
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");

        console.log("Deployer:         ", deployer);
        console.log("Semaphore:        ", semaphoreAddress);
        console.log("EAS:              ", easAddress);
        console.log("Schema registry:  ", schemaRegistryAddress);

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        // ── 1. Deploy PragueExplorer ──────────────────────────────────────────
        PragueExplorer explorer = new PragueExplorer(semaphoreAddress, easAddress);
        console.log("PragueExplorer:   ", address(explorer));

        // ── 2. Register EAS schema ────────────────────────────────────────────
        ISchemaRegistry registry = ISchemaRegistry(schemaRegistryAddress);
        bytes32 schemaUID = registry.register(
            ATTESTATION_SCHEMA,
            address(0), // no on-chain resolver
            false // non-revocable (a claim is permanent)
        );
        console.log("Schema UID:       ");
        console.logBytes32(schemaUID);

        explorer.setAttestationSchemaUID(schemaUID);

        // ── 3. Register the 6 Prague caches ──────────────────────────────────
        // Cache metadata is stored in caches.json; the contract stores only the
        // CID pointer. For the hackathon demo we use bytes32(cacheId) as a
        // placeholder CID. TODO(human): replace with real IPFS CIDs after
        // uploading caches.json to IPFS/Filecoin.
        _registerCaches(explorer);

        vm.stopBroadcast();

        // Summary
        console.log("---------------------------------------------");
        console.log("Deployment complete. Add to .env:");
        console.log("NEXT_PUBLIC_PRAGUE_EXPLORER_ADDRESS=", address(explorer));
        console.log("NEXT_PUBLIC_EAS_SCHEMA_UID=");
        console.logBytes32(schemaUID);
        console.log("---------------------------------------------");
    }

    function _registerCaches(PragueExplorer explorer) internal {
        // Receive-only demo addresses generated 2026-05-08, private keys discarded.
        // Represent Prague cultural institutions. TODO(human): replace with verified
        // institution multisig addresses before public launch.
        explorer.registerCache(1, bytes32(uint256(1)), 0x7B98698fc5F430b9f4b51691ed78Fe5a805902aB);
        console.log("Registered cache 1: Vysehrad (Sprava Vysehrad)");

        explorer.registerCache(2, bytes32(uint256(2)), 0x8890e8f0D89bec707C99e80Ed4F0e463eb5B8E80);
        console.log("Registered cache 2: Narodni trida (USTR)");

        explorer.registerCache(3, bytes32(uint256(3)), 0xc8B427BE431bcD3a104070A629523a3b7EA8772c);
        console.log("Registered cache 3: Staromestske namesti (Muzeum hl. m. Prahy)");

        explorer.registerCache(4, bytes32(uint256(4)), 0x5906F65B373Ca0E172C704a05c9736838D7257C0);
        console.log("Registered cache 4: Zizkov TV Tower (DOX)");

        explorer.registerCache(5, bytes32(uint256(5)), 0xd9cbb64461b29751f38Befbc20223181D6e70762);
        console.log("Registered cache 5: Letna (Memory of Nations Foundation)");

        explorer.registerCache(6, bytes32(uint256(6)), 0x665eF14222739A667A16198B6b62dc204f1771E4);
        console.log("Registered cache 6: Kampa (Museum Kampa)");
    }
}
