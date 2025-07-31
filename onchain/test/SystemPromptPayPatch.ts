import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SystemPromptPayPatch } from "../typechain-types";

/* ───── deploy fresh contract for every test ───── */
async function deployFixture() {
  const [owner, user1, user2] = await ethers.getSigners();
  const initial = "Hello";

  const F = await ethers.getContractFactory("SystemPromptPayPatch", owner);
  const contract = (await F.deploy(initial)) as unknown as SystemPromptPayPatch;

  const ppb = await contract.pricePerByte();
  return { contract, owner, user1, user2, initial, ppb };
}

/* ───── helper: KEEP‑then‑INSERT patch ─────────── */
function keepInsert(oldTxt: string, suffix: string) {
  const keep = oldTxt.length;
  const bytes: number[] = [
    0x00,
    (keep >> 8) & 0xff,
    keep & 0xff, // KEEP
    0x02,
    0x00,
    suffix.length, // INSERT
  ];
  for (let i = 0; i < suffix.length; ++i) bytes.push(suffix.charCodeAt(i));
  return {
    hex: ethers.hexlify(Uint8Array.from(bytes)) as `0x${string}`,
    changed: BigInt(suffix.length),
  };
}

/* ───── tests ──────────────────────────────────── */
describe("SystemPromptPayPatch", () => {
  it("deploys and stores initial text", async () => {
    const { contract, owner, initial } = await loadFixture(deployFixture);
    expect(await contract.owner()).to.equal(owner.address);
    expect(await contract.text()).to.equal(initial);
  });

  /* ---------- applyPatch ----------------------- */
  describe("applyPatch()", () => {
    it("updates doc and charges exact fee", async () => {
      const { contract, user1, ppb, initial } = await loadFixture(
        deployFixture
      );

      const { hex, changed } = keepInsert(initial, "!");
      const fee = changed * ppb;

      await expect(contract.connect(user1).applyPatch(hex, { value: fee }))
        .to.emit(contract, "Patched")
        .withArgs(
          1, // version id
          user1.address,
          changed,
          fee,
          initial.length + 1,
          ethers.keccak256(ethers.toUtf8Bytes(initial + "!"))
        );

      expect(await contract.text()).to.equal(initial + "!");
    });

    it("reverts when under‑paying", async () => {
      const { contract, user1, ppb, initial } = await loadFixture(
        deployFixture
      );
      const { hex, changed } = keepInsert(initial, "?");
      await expect(
        contract.connect(user1).applyPatch(hex, { value: changed * ppb - 1n })
      ).to.be.revertedWith("under pay");
    });
  });

  /* ---------- price admin ---------------------- */
  describe("setPrice()", () => {
    it("owner can change price", async () => {
      const { contract, owner } = await loadFixture(deployFixture);
      await contract.connect(owner).setPrice(2n * 10n ** 13n);
      expect(await contract.pricePerByte()).to.equal(2n * 10n ** 13n);
    });
    it("non‑owner cannot", async () => {
      const { contract, user1 } = await loadFixture(deployFixture);
      await expect(contract.connect(user1).setPrice(5n)).to.be.revertedWith(
        "!owner"
      );
    });
  });

  /* ---------- version history ------------------ */
  it("keeps all previous versions", async () => {
    const { contract, user1, ppb, initial } = await loadFixture(deployFixture);
    const { hex, changed } = keepInsert(initial, "!");
    await contract.connect(user1).applyPatch(hex, { value: changed * ppb });

    expect(await contract.textAt(0)).to.equal(initial);
    expect(await contract.textAt(1)).to.equal(initial + "!");
  });

  /* ---------- withdraw ------------------------- */
  it("owner can withdraw collected fees", async () => {
    const { contract, owner, user1, ppb, initial } = await loadFixture(
      deployFixture
    );
    const { hex, changed } = keepInsert(initial, "!");
    const fee = changed * ppb;
    await contract.connect(user1).applyPatch(hex, { value: fee });

    const before = await ethers.provider.getBalance(owner.address);
    const tx = await contract.connect(owner).withdraw();
    const r = await tx.wait();
    const gas = r!.gasUsed * (tx.gasPrice ?? 0n);
    const after = await ethers.provider.getBalance(owner.address);

    expect(after).to.equal(before + fee - gas);
    expect(await ethers.provider.getBalance(contract.getAddress())).to.equal(
      0n
    );
  });
});
