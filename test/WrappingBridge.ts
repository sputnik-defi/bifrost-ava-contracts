import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Bridge } from "../typechain-types";
import { computeContractAddress } from "./utils";

describe("WrappingBridge", () => {
  let Bridge: Bridge;
  let accounts: SignerWithAddress[];
  let oracle: SignerWithAddress;
  let tokenAddress: string;

  let testCoinId = 111;

  before(async () => {
    accounts = await ethers.getSigners();
    oracle = accounts[0];
    const factory = await ethers.getContractFactory("Bridge");
    Bridge = await factory.deploy([oracle.address]);

    await Bridge.deployed();
  });

  it("should lock eth and emit event", async () => {
    const value = 10;
    const destAddress = accounts[1].address;
    const destChain = 1;

    const tx = await Bridge.lock(destAddress, destChain, { value });
    const receipt = await tx.wait();

    const event = receipt.events?.[0];

    expect(event?.event).to.equal("Lock");
    expect(event?.args?.from).to.equal(accounts[0].address);
    expect(event?.args?.value).to.equal(value);
    expect(event?.args?.destAddress).to.equal(destAddress);
    expect(event?.args?.destChain).to.equal(destChain);
  });

  it("should unlock eth and emit event", async () => {
    const value = 10;
    const destAddress = accounts[1].address;

    const oldBalance = await accounts[1].getBalance();

    // Lock some eth to fund contract.
    const tx1 = await Bridge.lock(destAddress, 1, { value });
    await tx1.wait();

    const tx2 = await Bridge.unlock(destAddress, value);
    const receipt = await tx2.wait();

    const newBalance = await accounts[1].getBalance();
    const event = receipt.events?.[0];

    expect(newBalance.sub(oldBalance)).to.equal(value);
    expect(event?.event).to.equal("Unlock");
    expect(event?.args?.to).to.equal(destAddress);
    expect(event?.args?.value).to.equal(value);
  });

  it("should create a new bridge token", async () => {
    const name = "Bridge Token";
    const symbol = "BRG";

    const bridgeNonce = await Bridge.provider.getTransactionCount(
      Bridge.address
    );
    const calculatedAddress = computeContractAddress(
      Bridge.address,
      bridgeNonce
    );

    const tx = await Bridge.createToken(name, symbol, testCoinId);
    const receipt = await tx.wait();

    const event = receipt.events?.find((e) => e.event === "TokenCreated");

    expect(event?.event).to.equal("TokenCreated");
    expect(event?.args?.coinId).to.equal(testCoinId);
    expect(event?.args?.tokenAddress).to.equal(calculatedAddress);

    tokenAddress = calculatedAddress;
  });

  it("should mint tokens and emit event", async () => {
    const value = 10;
    const destAddress = accounts[1].address;

    const tx = await Bridge.mintERC20(testCoinId, destAddress, value);
    const receipt = await tx.wait();

    const event = receipt.events?.find((e) => e.event === "MintERC20");

    expect(event?.event).to.equal("MintERC20");
    expect(event?.args?.coinId).to.equal(testCoinId);
    expect(event?.args?.to).to.equal(destAddress);
    expect(event?.args?.value).to.equal(value);

    const token = await ethers.getContractAt("Token", tokenAddress);
    const balance = await token.balanceOf(destAddress);

    expect(balance).to.equal(value);
  });
});
