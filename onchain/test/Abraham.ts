// test/Abraham.separate-staking.spec.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

/* helpers */
function toBI(v: any): bigint {
  if (typeof v === "bigint") return v;
  if (v && typeof v.toBigInt === "function") return v.toBigInt();
  return BigInt(v.toString());
}

async function deployFixture() {
  const [deployer, user1, user2] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("AbrahamToken", deployer);
  const token = await Token.deploy();
  await token.waitForDeployment();

  const Staking = await ethers.getContractFactory("AbrahamStaking", deployer);
  const staking = await Staking.deploy(await token.getAddress());
  await staking.waitForDeployment();

  const Abraham = await ethers.getContractFactory("Abraham", deployer);
  const abraham = await Abraham.deploy(await staking.getAddress());
  await abraham.waitForDeployment();

  const e18 = 10n ** 18n;
  const give = 100_000n * e18;
  await (await token.transfer(user1.address, give)).wait();
  await (await token.transfer(user2.address, give)).wait();

  const N = toBI(await abraham.praiseRequirement());
  const X = toBI(await abraham.blessRequirement());

  return { deployer, user1, user2, token, staking, abraham, N, X, e18 };
}

function enc(bytes: any[]): string {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  return coder.encode(
    bytes.map(() => "bytes"),
    bytes
  ); // staking ignores data anyway
}

async function stake(user: any, token: any, staking: any, amount: bigint) {
  await (
    await token
      .connect(user)
      .transferAndCall(await staking.getAddress(), amount, "0x")
  ).wait();
}

/* ids & cids */
const S1 = "session-aaa";
const S2 = "session-bbb";
const M1 = "msg-0001";
const M2 = "msg-0002";
const M3 = "msg-0003";

const B1 = "bless-01";
const B2 = "bless-02";

const CID_A = "ipfs://cid-a";
const CID_B = "ipfs://cid-b";
const CID_C = "ipfs://cid-c";
const CID_D = "ipfs://cid-d";

describe("Abraham (separate staking, linking & points in Abraham)", () => {
  it("owner is deployer", async () => {
    const { abraham, deployer } = await loadFixture(deployFixture);
    expect(await abraham.owner()).to.equal(deployer.address);
  });

  describe("sessions", () => {
    it("create & basic stats", async () => {
      const { abraham } = await loadFixture(deployFixture);
      await expect(abraham.createSession(S1, M1, CID_A))
        .to.emit(abraham, "SessionCreated")
        .withArgs(S1);
      const [mc, tb, tp, closed, linked] = await abraham.getSessionStats(S1);
      expect(mc).to.equal(1);
      expect(tb).to.equal(0);
      expect(tp).to.equal(0);
      expect(closed).to.equal(false);
      expect(linked).to.equal(0);
    });
  });

  describe("staking vault (global), linking enforced per action", () => {
    it("user must have enough global stake to link on bless/praise", async () => {
      const { abraham, staking, token, user1, N, X } = await loadFixture(
        deployFixture
      );
      await abraham.createSession(S1, M1, CID_A);

      // no stake -> cannot bless/praise
      await expect(
        abraham.connect(user1).bless(S1, B1, CID_B)
      ).to.be.revertedWith("insufficient global stake");
      await expect(abraham.connect(user1).praise(S1, M1)).to.be.revertedWith(
        "insufficient global stake"
      );

      // stake X -> one bless ok, second bless not ok
      await stake(user1, token, staking, X);
      await expect(abraham.connect(user1).bless(S1, B1, CID_B)).to.emit(
        abraham,
        "MessageAdded"
      );
      await expect(
        abraham.connect(user1).bless(S1, "b2", CID_C)
      ).to.be.revertedWith("insufficient global stake");

      // add N -> now one praise ok
      await stake(user1, token, staking, N);
      await expect(abraham.connect(user1).praise(S1, M1)).to.emit(
        abraham,
        "Praised"
      );

      const totalLinked = await abraham.getUserTotalLinked(user1.address);
      expect(toBI(totalLinked)).to.equal(X + N);

      const [, , , , linkedTotal] = await abraham.getSessionStats(S1);
      expect(toBI(linkedTotal)).to.equal(X + N);
    });

    it("cross-session constraint: total linked across all sessions <= global staked", async () => {
      const { abraham, staking, token, user1, X } = await loadFixture(
        deployFixture
      );
      await abraham.createSession(S1, M1, CID_A);
      await abraham.createSession(S2, M1, CID_A);

      await stake(user1, token, staking, X); // only X globally
      await expect(abraham.connect(user1).bless(S1, B1, CID_B)).to.emit(
        abraham,
        "MessageAdded"
      );

      // trying to bless in S2 (needs +X) should fail (would exceed global stake)
      await expect(
        abraham.connect(user1).bless(S2, B1, CID_C)
      ).to.be.revertedWith("insufficient global stake");
    });

    it("unstaking later does not unlink past; it just blocks new linking", async () => {
      const { abraham, staking, token, user1, N, X } = await loadFixture(
        deployFixture
      );
      await abraham.createSession(S1, M1, CID_A);

      await stake(user1, token, staking, X + N);
      await expect(abraham.connect(user1).bless(S1, B1, CID_B)).to.emit(
        abraham,
        "MessageAdded"
      );
      await expect(abraham.connect(user1).praise(S1, M1)).to.emit(
        abraham,
        "Praised"
      );

      // unstake everything
      await (await staking.connect(user1).unstake(X + N)).wait();

      // history remains; new link fails
      await expect(abraham.connect(user1).praise(S1, M1)).to.be.revertedWith(
        "insufficient global stake"
      );
    });
  });

  describe("points accrual per (user, creation)", () => {
    it("points += linked * time, updated on next action", async () => {
      const { abraham, staking, token, user1, X } = await loadFixture(
        deployFixture
      );
      await abraham.createSession(S1, M1, CID_A);

      await stake(user1, token, staking, X);
      await expect(abraham.connect(user1).bless(S1, B1, CID_B)).to.emit(
        abraham,
        "MessageAdded"
      );

      // after first bless, linked = X
      let [linked, last, pts] = await abraham.getUserLinkInfo(
        S1,
        user1.address
      );
      expect(toBI(linked)).to.equal(X);

      await time.increase(24 * 60 * 60);

      // trigger another action that accrues first
      await expect(abraham.connect(user1).praise(S1, M1)).to.be.revertedWith(
        "insufficient global stake"
      );

      // stake N so we can praise now
      const N = toBI(await abraham.praiseRequirement());
      await stake(user1, token, staking, N);
      await expect(abraham.connect(user1).praise(S1, M1)).to.emit(
        abraham,
        "Praised"
      );

      // now points should have increased by X * 86400
      [linked, last, pts] = await abraham.getUserLinkInfo(S1, user1.address);
      expect(toBI(pts)).to.equal(X * 86400n);
      expect(toBI(linked)).to.equal(X + N);
    });
  });

  describe("batch actions", () => {
    it("batchPraise checks link delta = n*N; batchBless delta = n*X", async () => {
      const { abraham, staking, token, user1 } = await loadFixture(
        deployFixture
      );
      const N = toBI(await abraham.praiseRequirement());
      const X = toBI(await abraham.blessRequirement());

      await abraham.createSession(S1, M1, CID_A);
      await abraham.abrahamUpdate(S1, M2, CID_B, false);
      await abraham.abrahamUpdate(S1, M3, CID_C, false);

      await stake(user1, token, staking, 2n * N + 2n * X);

      await expect(
        abraham.connect(user1).batchBless(S1, ["b1", "b2"], [CID_B, CID_C])
      ).to.emit(abraham, "MessageAdded");

      await expect(abraham.connect(user1).batchPraise(S1, [M1, M2])).to.emit(
        abraham,
        "Praised"
      );

      const totalLinked = await abraham.getUserTotalLinked(user1.address);
      expect(toBI(totalLinked)).to.equal(2n * X + 2n * N);
    });
  });

  describe("owner batch", () => {
    it("abrahamBatchCreate/update across sessions unchanged", async () => {
      const { abraham } = await loadFixture(deployFixture);
      await abraham.abrahamBatchCreate([
        { sessionId: "A", firstMessageId: "a0", cid: CID_A },
        { sessionId: "B", firstMessageId: "b0", cid: CID_B },
      ]);

      await expect(
        abraham.abrahamBatchUpdateAcrossSessions([
          { sessionId: "A", messageId: "a1", cid: CID_C, closed: false },
          { sessionId: "B", messageId: "b1", cid: CID_D, closed: true },
        ])
      ).to.emit(abraham, "MessageAdded");
    });
  });

  describe("admin params", () => {
    it("setRequirements", async () => {
      const { abraham, deployer } = await loadFixture(deployFixture);
      await (await abraham.connect(deployer).setRequirements(1n, 2n)).wait();
      expect(await abraham.praiseRequirement()).to.equal(1n);
      expect(await abraham.blessRequirement()).to.equal(2n);
    });
  });
});
