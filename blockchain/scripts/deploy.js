const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const networkName = hre.network.name;
    console.log(`\nDeploying PDSLedger to "${networkName}" ...`);

    const [deployer] = await hre.ethers.getSigners();
    const balance = await hre.ethers.provider.getBalance(deployer.address);

    console.log("Deployer address :", deployer.address);
    console.log("Deployer balance :", hre.ethers.formatEther(balance), "ETH");

    if (networkName === "sepolia" && balance < hre.ethers.parseEther("0.005")) {
        throw new Error(
            "Insufficient Sepolia ETH (need ≥ 0.005). " +
            "Get test ETH from https://sepoliafaucet.com"
        );
    }

    // Deploy
    const Factory = await hre.ethers.getContractFactory("PDSLedger");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    const deployTx = contract.deploymentTransaction();

    console.log("\n✅  PDSLedger deployed successfully!");
    console.log("Contract address      :", contractAddress);
    console.log("Deployer address      :", deployer.address);
    console.log("Deployment tx hash    :", deployTx.hash);
    console.log("Network               :", networkName);

    if (networkName === "sepolia") {
        console.log(
            "Etherscan URL         :",
            `https://sepolia.etherscan.io/address/${contractAddress}`
        );
    }

    // Persist deployment info (no secrets)
    const info = {
        network: networkName,
        contractAddress: contractAddress,
        deployerAddress: deployer.address,
        deployedAt: new Date().toISOString(),
        txHash: deployTx.hash,
        etherscan: networkName === "sepolia"
            ? `https://sepolia.etherscan.io/address/${contractAddress}`
            : null,
    };

    const outPath = path.join(__dirname, "../deployments.json");
    fs.writeFileSync(outPath, JSON.stringify(info, null, 2));
    console.log("\nDeployment saved to blockchain/deployments.json");

    // Print what to add to pds-backend/.env
    console.log("\n=== ADD TO pds-backend/.env ===");
    console.log(`BLOCKCHAIN_CONTRACT_ADDRESS=${contractAddress}`);
    console.log(`BLOCKCHAIN_NETWORK=sepolia`);
    console.log(`BLOCKCHAIN_RPC_URL=<your Alchemy/Infura Sepolia URL>`);
    console.log(`BLOCKCHAIN_PRIVATE_KEY=<same private key as blockchain/.env — never commit>`);
    console.log("================================\n");
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
