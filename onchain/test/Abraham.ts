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

  const PRAISE_PRICE = await contract.PRAISE_PRICE();
  const BLESS_PRICE = await contract.BLESS_PRICE();

  return { contract, abraham, user1, user2, PRAISE_PRICE, BLESS_PRICE };
}

/* helper uuids */
const S1 = "session‑aaa"; // simple ascii UUIDs for clarity
const M1 = "msg‑0001";
const M2 = "msg‑0002";
const B1 = "bless‑01";

/* ---------------------------------------------------------- */
/*                        TESTS                               */
/* ---------------------------------------------------------- */
describe("Abraham contract (UUID ids)", () => {
  /* ----------------------- deploy ------------------------ */
  it("sets deployer as owner", async () => {
    const { contract, abraham } = await loadFixture(deployFixture);
    expect(await contract.owner()).to.equal(abraham.address);
  });

  /* ------------------ session creation ------------------- */
  describe("createSession", () => {
    it("owner can create a session with media", async () => {
      const { contract } = await loadFixture(deployFixture);

      await expect(
        contract.createSession(S1, M1, "first image", "ipfs://hashA")
      )
        .to.emit(contract, "SessionCreated")
        .withArgs(S1);

      const ids = await contract.getMessageIds(S1);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(M1);

      const [author, , media] = await contract.getMessage(S1, M1);
      expect(media).to.equal("ipfs://hashA");
      expect(author).to.equal(await contract.owner());
    });

    it("reverts if non‑owner calls", async () => {
      const { contract, user1 } = await loadFixture(deployFixture);
      await expect(
        contract.connect(user1).createSession(S1, M1, "hack", "ipfs://bad")
      )
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });

    it("reverts on duplicate session id", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract.createSession(S1, M1, "ok", "ipfs://y");

      await expect(
        contract.createSession(S1, "msg‑dup", "again", "ipfs://z")
      ).to.be.revertedWith("Session exists");
    });
  });

  /* ------------------ abrahamUpdate ---------------------- */
  describe("abrahamUpdate", () => {
    it("owner can append an image update", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract.createSession(S1, M1, "v1", "ipfs://a");

      await expect(contract.abrahamUpdate(S1, M2, "v2", "ipfs://b")).to.emit(
        contract,
        "MessageAdded"
      );

      const ids = await contract.getMessageIds(S1);
      expect(ids.length).to.equal(2);
      const [, , media] = await contract.getMessage(S1, M2);
      expect(media).to.equal("ipfs://b");
    });

    it("reverts for missing media", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract.createSession(S1, M1, "v1", "ipfs://a");
      await expect(
        contract.abrahamUpdate(S1, M2, "bad", "")
      ).to.be.revertedWith("Media required");
    });
  });

  /* ---------------------- bless -------------------------- */
  describe("bless", () => {
    it("user can bless with exact fee", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);
      await contract.createSession(S1, M1, "v1", "ipfs://a");

      await expect(
        contract
          .connect(user1)
          .bless(S1, B1, "make it purple", { value: BLESS_PRICE })
      ).to.emit(contract, "MessageAdded");

      const ids = await contract.getMessageIds(S1);
      expect(ids.length).to.equal(2);

      const [author, content, media] = await contract.getMessage(S1, B1);
      expect(author).to.equal(user1.address);
      expect(content).to.equal("make it purple");
      expect(media).to.equal("");
    });

    it("fails with wrong fee or empty content", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);
      await contract.createSession(S1, M1, "v1", "ipfs://a");

      await expect(
        contract.connect(user1).bless(S1, B1, "hi", { value: BLESS_PRICE - 1n })
      ).to.be.revertedWith("Incorrect ETH");

      await expect(
        contract.connect(user1).bless(S1, B1, "", { value: BLESS_PRICE })
      ).to.be.revertedWith("Content required");
    });

    it("fails for unknown session", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);
      await expect(
        contract.connect(user1).bless("ghost", B1, "hi", { value: BLESS_PRICE })
      ).to.be.revertedWith("Session not found");
    });
  });

  /* ---------------------- praise ------------------------- */
  describe("praise", () => {
    it("user can praise once with correct fee", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );
      await contract.createSession(S1, M1, "v1", "ipfs://a");

      await expect(
        contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE })
      ).to.emit(contract, "Praised");

      const [, , , pc] = await contract.getMessage(S1, M1);
      expect(pc).to.equal(1);

      await expect(
        contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE })
      ).to.be.revertedWith("Already praised");
    });
  });

  /* --------------------- withdraw ------------------------ */
  describe("withdraw", () => {
    it("transfers all ETH to owner", async () => {
      const { contract, abraham, user1, PRAISE_PRICE, BLESS_PRICE } =
        await loadFixture(deployFixture);

      await contract.createSession(S1, M1, "art", "ipfs://media");
      await contract.connect(user1).bless(S1, B1, "hi", { value: BLESS_PRICE });
      await contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE });

      const before = await ethers.provider.getBalance(abraham.address);
      const tx = await contract.withdraw();
      const r = await tx.wait();

      const gas = r!.gasUsed * (tx.gasPrice || 0n);
      const after = await ethers.provider.getBalance(abraham.address);

      expect(after).to.equal(before + PRAISE_PRICE + BLESS_PRICE - gas);
    });
  });
});
