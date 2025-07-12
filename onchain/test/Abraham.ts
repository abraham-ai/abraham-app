import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Abraham } from "../typechain-types";

/* ---------------------------------------------------------- */
/*                         FIXTURE                            */
/* ---------------------------------------------------------- */
async function deployFixture() {
  const [abraham, user1, user2] = await ethers.getSigners();

  const AbrahamFactory = await ethers.getContractFactory("Abraham", abraham);
  const contract = (await AbrahamFactory.deploy()) as Abraham;

  // read on-chain constants
  const PRAISE_PRICE = await contract.PRAISE_PRICE();
  const BLESS_PRICE = await contract.BLESS_PRICE();

  return { contract, abraham, user1, user2, PRAISE_PRICE, BLESS_PRICE };
}

/* ---------------------------------------------------------- */
/*                        TESTS                               */
/* ---------------------------------------------------------- */
describe("Abraham contract", () => {
  /* ----------------------- deploy ------------------------ */
  it("sets the deployer as owner", async () => {
    const { contract, abraham } = await loadFixture(deployFixture);
    expect(await contract.owner()).to.equal(abraham.address);
  });

  /* ------------------ session creation ------------------- */
  describe("createSession", () => {
    it("owner can create a session with media", async () => {
      const { contract } = await loadFixture(deployFixture);

      await expect(contract.createSession("first love image", "ipfs://hashA"))
        .to.emit(contract, "SessionCreated")
        .withArgs(1);

      // messageCount should be 1
      expect(await contract.getMessageCount(1)).to.equal(1);

      const [author, , media] = await contract.getMessage(1, 0);
      expect(media).to.equal("ipfs://hashA");
      expect(author).to.equal(await contract.owner());
    });

    it("reverts if non-owner tries", async () => {
      const { contract, user1 } = await loadFixture(deployFixture);
      await expect(contract.connect(user1).createSession("hack", "ipfs://bad"))
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });

    it("reverts if media is empty", async () => {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.createSession("no media", "")).to.be.revertedWith(
        "Media required for first message"
      );
    });
  });

  /* ------------------ abrahamUpdate ---------------------- */
  describe("abrahamUpdate", () => {
    it("owner can append an image update", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract.createSession("v1", "ipfs://a");

      await expect(contract.abrahamUpdate(1, "v2", "ipfs://b")).to.emit(
        contract,
        "MessageAdded"
      );

      expect(await contract.getMessageCount(1)).to.equal(2);
      const [, , media] = await contract.getMessage(1, 1);
      expect(media).to.equal("ipfs://b");
    });

    it("reverts for missing media", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract.createSession("v1", "ipfs://a");
      await expect(contract.abrahamUpdate(1, "bad", "")).to.be.revertedWith(
        "Media required"
      );
    });

    it("reverts if non-owner calls", async () => {
      const { contract, user1 } = await loadFixture(deployFixture);
      await contract.createSession("v1", "ipfs://a");
      await expect(contract.connect(user1).createSession("hack", "ipfs://bad"))
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });
  });

  /* ---------------------- bless -------------------------- */
  describe("bless", () => {
    it("user can bless with exact fee", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);
      await contract.createSession("v1", "ipfs://a");

      await expect(
        contract
          .connect(user1)
          .bless(1, "make it purple", { value: BLESS_PRICE })
      ).to.emit(contract, "MessageAdded");

      expect(await contract.getMessageCount(1)).to.equal(2);

      const [author, content, media] = await contract.getMessage(1, 1);
      expect(author).to.equal(user1.address);
      expect(content).to.equal("make it purple");
      expect(media).to.equal("");
    });

    it("fails with wrong fee or empty content", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);
      await contract.createSession("v1", "ipfs://a");

      await expect(
        contract.connect(user1).bless(1, "hi", { value: BLESS_PRICE - 1n })
      ).to.be.revertedWith("Incorrect ETH for blessing");

      await expect(
        contract.connect(user1).bless(1, "", { value: BLESS_PRICE })
      ).to.be.revertedWith("Content required");
    });

    it("fails for non-existent session", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);
      await expect(
        contract.connect(user1).bless(42, "ghost", { value: BLESS_PRICE })
      ).to.be.revertedWith("Session not found");
    });
  });

  /* ---------------------- praise ------------------------- */
  describe("praise", () => {
    it("user can praise once with correct fee", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );
      await contract.createSession("v1", "ipfs://a");

      await expect(
        contract.connect(user1).praise(1, 0, { value: PRAISE_PRICE })
      ).to.emit(contract, "Praised");

      const [, , , praiseCount] = await contract.getMessage(1, 0);
      expect(praiseCount).to.equal(1);

      // second praise from same user should revert
      await expect(
        contract.connect(user1).praise(1, 0, { value: PRAISE_PRICE })
      ).to.be.revertedWith("Already praised");
    });

    it("fails with wrong fee", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );
      await contract.createSession("v1", "ipfs://a");
      await expect(
        contract.connect(user1).praise(1, 0, { value: PRAISE_PRICE - 1n })
      ).to.be.revertedWith("Incorrect ETH for praise");
    });

    it("fails for bad indices", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );
      await expect(
        contract.connect(user1).praise(99, 0, { value: PRAISE_PRICE })
      ).to.be.revertedWith("Session not found");

      await contract.createSession("v1", "ipfs://a");
      await expect(
        contract.connect(user1).praise(1, 9, { value: PRAISE_PRICE })
      ).to.be.revertedWith("Message not found");
    });
  });

  /* --------------------- withdraw ------------------------ */
  describe("withdraw", () => {
    it("transfers all ETH to owner", async () => {
      const { contract, abraham, user1, PRAISE_PRICE, BLESS_PRICE } =
        await loadFixture(deployFixture);

      // generate balance inside contract (1 bless + 1 praise)
      await contract.createSession("art", "ipfs://media");
      await contract.connect(user1).bless(1, "hi", { value: BLESS_PRICE });
      await contract.connect(user1).praise(1, 0, { value: PRAISE_PRICE });

      const balanceBefore = await ethers.provider.getBalance(abraham.address);

      const tx = await contract.withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * (tx.gasPrice || 0n);

      const balanceAfter = await ethers.provider.getBalance(abraham.address);

      expect(balanceAfter).to.equal(
        balanceBefore + PRAISE_PRICE + BLESS_PRICE - gasUsed
      );
    });

    it("reverts if non-owner calls", async () => {
      const { contract, user1 } = await loadFixture(deployFixture);
      await expect(contract.connect(user1).createSession("hack", "ipfs://bad"))
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });
  });

  /* ------------------- view helpers ---------------------- */
  describe("view functions", () => {
    it("getPraisers returns expected list", async () => {
      const { contract, user1, user2, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );

      await contract.createSession("v1", "ipfs://a");
      await contract.connect(user1).praise(1, 0, { value: PRAISE_PRICE });
      await contract.connect(user2).praise(1, 0, { value: PRAISE_PRICE });

      const praisers = await contract.getPraisers(1, 0);
      const praisersArr = [...praisers]; // unwrap the read-only Result
      expect(praisersArr).to.have.members([user1.address, user2.address]);
    });
  });
});
