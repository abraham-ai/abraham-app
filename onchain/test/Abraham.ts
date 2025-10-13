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

  // Deploy Abraham Token
  const Token = await ethers.getContractFactory("AbrahamToken", deployer);
  const token = await Token.deploy();
  await token.waitForDeployment();

  // Deploy Staking Pool
  const Staking = await ethers.getContractFactory("AbrahamStaking", deployer);
  const staking = await Staking.deploy(await token.getAddress());
  await staking.waitForDeployment();

  // Deploy AbrahamCreations with both addresses
  const AbrahamCreations = await ethers.getContractFactory(
    "AbrahamCreations",
    deployer
  );
  const abrahamCreations = await AbrahamCreations.deploy(
    await staking.getAddress(),
    await token.getAddress()
  );
  await abrahamCreations.waitForDeployment();

  // Give tokens to test users
  const e18 = 10n ** 18n;
  const give = 100_000n * e18;
  await (await token.transfer(user1.address, give)).wait();
  await (await token.transfer(user2.address, give)).wait();

  // Get requirements
  const blessingReq = toBI(await abrahamCreations.blessingRequirement());
  const commandmentReq = toBI(await abrahamCreations.commandmentRequirement());

  return {
    deployer,
    user1,
    user2,
    token,
    staking,
    abrahamCreations,
    blessingReq,
    commandmentReq,
    e18,
  };
}

async function stake(user: any, token: any, staking: any, amount: bigint) {
  // Approve and stake
  await (
    await token.connect(user).approve(await staking.getAddress(), amount)
  ).wait();
  const lockingPeriod = 7 * 24 * 60 * 60; // 1 week minimum
  await (await staking.connect(user).stake(amount, lockingPeriod)).wait();
}

/* ids & cids */
const S1 = "session-aaa";
const S2 = "session-bbb";
const M1 = "msg-0001";
const M2 = "msg-0002";
const M3 = "msg-0003";

const B1 = "blessing-01";
const B2 = "blessing-02";

const CID_A = "ipfs://cid-a";
const CID_B = "ipfs://cid-b";
const CID_C = "ipfs://cid-c";
const CID_D = "ipfs://cid-d";

describe("AbrahamCreations (with external StakingPool)", () => {
  it("owner is deployer", async () => {
    const { abrahamCreations, deployer } = await loadFixture(deployFixture);
    expect(await abrahamCreations.owner()).to.equal(deployer.address);
  });

  it("stakingPool and abrahamToken are set correctly", async () => {
    const { abrahamCreations, staking, token } = await loadFixture(
      deployFixture
    );
    expect(await abrahamCreations.stakingPool()).to.equal(
      await staking.getAddress()
    );
    expect(await abrahamCreations.abrahamToken()).to.equal(
      await token.getAddress()
    );
  });

  describe("sessions", () => {
    it("create & basic stats", async () => {
      const { abrahamCreations } = await loadFixture(deployFixture);
      await expect(abrahamCreations.createSession(S1, M1, CID_A))
        .to.emit(abrahamCreations, "SessionCreated")
        .withArgs(S1);

      const [mc, totalCommandments, totalBlessings, closed, linked] =
        await abrahamCreations.getSessionStats(S1);
      expect(mc).to.equal(1);
      expect(totalBlessings).to.equal(0);
      expect(totalCommandments).to.equal(0);
      expect(closed).to.equal(false);
      expect(linked).to.equal(0);
    });
  });

  describe("staking integration (global), linking enforced per action", () => {
    it("user must have enough global stake to link on blessing/commandment", async () => {
      const {
        abrahamCreations,
        staking,
        token,
        user1,
        blessingReq,
        commandmentReq,
      } = await loadFixture(deployFixture);
      await abrahamCreations.createSession(S1, M1, CID_A);

      // no stake -> cannot commandment/blessing
      await expect(
        abrahamCreations.connect(user1).commandment(S1, B1, CID_B)
      ).to.be.revertedWith("insufficient global stake");

      await expect(
        abrahamCreations.connect(user1).blessing(S1, M1)
      ).to.be.revertedWith("insufficient global stake");

      // stake commandmentReq -> one commandment ok, second commandment not ok
      await stake(user1, token, staking, commandmentReq);
      await expect(
        abrahamCreations.connect(user1).commandment(S1, B1, CID_B)
      ).to.emit(abrahamCreations, "MessageAdded");

      await expect(
        abrahamCreations.connect(user1).commandment(S1, "b2", CID_C)
      ).to.be.revertedWith("insufficient global stake");

      // add blessingReq -> now one blessing ok
      await stake(user1, token, staking, blessingReq);
      await expect(abrahamCreations.connect(user1).blessing(S1, M1)).to.emit(
        abrahamCreations,
        "Blessed"
      );

      const totalLinked = await abrahamCreations.getUserTotalLinked(
        user1.address
      );
      expect(toBI(totalLinked)).to.equal(commandmentReq + blessingReq);

      const [, , , , linkedTotal] = await abrahamCreations.getSessionStats(S1);
      expect(toBI(linkedTotal)).to.equal(commandmentReq + blessingReq);
    });

    it("cross-session constraint: total linked across all sessions <= global staked", async () => {
      const { abrahamCreations, staking, token, user1, commandmentReq } =
        await loadFixture(deployFixture);
      await abrahamCreations.createSession(S1, M1, CID_A);
      await abrahamCreations.createSession(S2, M1, CID_A);

      await stake(user1, token, staking, commandmentReq); // only commandmentReq globally
      await expect(
        abrahamCreations.connect(user1).commandment(S1, B1, CID_B)
      ).to.emit(abrahamCreations, "MessageAdded");

      // trying to commandment in S2 (needs +commandmentReq) should fail (would exceed global stake)
      await expect(
        abrahamCreations.connect(user1).commandment(S2, B1, CID_C)
      ).to.be.revertedWith("insufficient global stake");
    });

    it("unstaking later does not unlink past; it just blocks new linking", async () => {
      const {
        abrahamCreations,
        staking,
        token,
        user1,
        blessingReq,
        commandmentReq,
      } = await loadFixture(deployFixture);
      await abrahamCreations.createSession(S1, M1, CID_A);

      await stake(user1, token, staking, commandmentReq + blessingReq);
      await expect(
        abrahamCreations.connect(user1).commandment(S1, B1, CID_B)
      ).to.emit(abrahamCreations, "MessageAdded");
      await expect(abrahamCreations.connect(user1).blessing(S1, M1)).to.emit(
        abrahamCreations,
        "Blessed"
      );

      // Advance time past locking period (1 week)
      await time.increase(8 * 24 * 60 * 60);

      // unstake everything
      await (
        await staking.connect(user1).unstake(commandmentReq + blessingReq)
      ).wait();

      // history remains; new link fails
      await expect(
        abrahamCreations.connect(user1).blessing(S1, M1)
      ).to.be.revertedWith("insufficient global stake");
    });
  });

  describe("points accrual per (user, creation)", () => {
    it("points += linked * time, updated on next action", async () => {
      const {
        abrahamCreations,
        staking,
        token,
        user1,
        commandmentReq,
        blessingReq,
      } = await loadFixture(deployFixture);
      await abrahamCreations.createSession(S1, M1, CID_A);

      await stake(user1, token, staking, commandmentReq);
      await expect(
        abrahamCreations.connect(user1).commandment(S1, B1, CID_B)
      ).to.emit(abrahamCreations, "MessageAdded");

      // after first commandment, linked = commandmentReq
      let [linked, last, pts] = await abrahamCreations.getUserLinkInfo(
        S1,
        user1.address
      );
      expect(toBI(linked)).to.equal(commandmentReq);

      await time.increase(24 * 60 * 60);

      // stake blessingReq so we can blessing now
      await stake(user1, token, staking, blessingReq);
      await expect(abrahamCreations.connect(user1).blessing(S1, M1)).to.emit(
        abrahamCreations,
        "Blessed"
      );

      // now points should have increased by commandmentReq * 86400
      [linked, last, pts] = await abrahamCreations.getUserLinkInfo(
        S1,
        user1.address
      );
      expect(toBI(pts)).to.equal(commandmentReq * 86400n);
      expect(toBI(linked)).to.equal(commandmentReq + blessingReq);
    });
  });

  describe("batch actions", () => {
    it("batchBlessing checks link delta = n*blessingReq; batchCommandment delta = n*commandmentReq", async () => {
      const {
        abrahamCreations,
        staking,
        token,
        user1,
        blessingReq,
        commandmentReq,
      } = await loadFixture(deployFixture);

      await abrahamCreations.createSession(S1, M1, CID_A);
      await abrahamCreations.abrahamUpdate(S1, M2, CID_B, false);
      await abrahamCreations.abrahamUpdate(S1, M3, CID_C, false);

      await stake(
        user1,
        token,
        staking,
        2n * blessingReq + 2n * commandmentReq
      );

      await expect(
        abrahamCreations
          .connect(user1)
          .batchCommandment(S1, ["b1", "b2"], [CID_B, CID_C])
      ).to.emit(abrahamCreations, "MessageAdded");

      await expect(
        abrahamCreations.connect(user1).batchBlessing(S1, [M1, M2])
      ).to.emit(abrahamCreations, "Blessed");

      const totalLinked = await abrahamCreations.getUserTotalLinked(
        user1.address
      );
      expect(toBI(totalLinked)).to.equal(
        2n * commandmentReq + 2n * blessingReq
      );
    });
  });

  describe("owner batch", () => {
    it("abrahamBatchCreate/update across sessions unchanged", async () => {
      const { abrahamCreations } = await loadFixture(deployFixture);
      await abrahamCreations.abrahamBatchCreate([
        { sessionId: "A", firstMessageId: "a0", cid: CID_A },
        { sessionId: "B", firstMessageId: "b0", cid: CID_B },
      ]);

      await expect(
        abrahamCreations.abrahamBatchUpdateAcrossSessions([
          { sessionId: "A", messageId: "a1", cid: CID_C, closed: false },
          { sessionId: "B", messageId: "b1", cid: CID_D, closed: true },
        ])
      ).to.emit(abrahamCreations, "MessageAdded");
    });
  });

  describe("admin params", () => {
    it("setRequirements", async () => {
      const { abrahamCreations, deployer } = await loadFixture(deployFixture);
      await (
        await abrahamCreations.connect(deployer).setRequirements(1n, 2n)
      ).wait();
      expect(await abrahamCreations.blessingRequirement()).to.equal(1n);
      expect(await abrahamCreations.commandmentRequirement()).to.equal(2n);
    });

    it("setStakingPool (owner only)", async () => {
      const { abrahamCreations, deployer, user1 } = await loadFixture(
        deployFixture
      );
      const newPool = ethers.Wallet.createRandom().address;

      // Non-owner cannot update
      await expect(abrahamCreations.connect(user1).setStakingPool(newPool)).to
        .be.reverted;

      // Owner can update
      await expect(
        abrahamCreations.connect(deployer).setStakingPool(newPool)
      ).to.emit(abrahamCreations, "StakingPoolUpdated");

      expect(await abrahamCreations.stakingPool()).to.equal(newPool);
    });

    it("setAbrahamToken (owner only)", async () => {
      const { abrahamCreations, deployer, user1 } = await loadFixture(
        deployFixture
      );
      const newToken = ethers.Wallet.createRandom().address;

      // Non-owner cannot update
      await expect(abrahamCreations.connect(user1).setAbrahamToken(newToken)).to
        .be.reverted;

      // Owner can update
      await expect(
        abrahamCreations.connect(deployer).setAbrahamToken(newToken)
      ).to.emit(abrahamCreations, "AbrahamTokenUpdated");

      expect(await abrahamCreations.abrahamToken()).to.equal(newToken);
    });
  });

  describe("tier system", () => {
    it("users get correct tier based on staked amount", async () => {
      const { abrahamCreations, staking, token, user1, deployer } =
        await loadFixture(deployFixture);

      // Set up tiers
      const tiers = [
        { minStake: 0n, maxBlessingsPerDay: 1, maxCommandmentsPerDay: 0 },
        {
          minStake: ethers.parseEther("100"),
          maxBlessingsPerDay: 5,
          maxCommandmentsPerDay: 2,
        },
        {
          minStake: ethers.parseEther("1000"),
          maxBlessingsPerDay: 10,
          maxCommandmentsPerDay: 5,
        },
      ];
      await abrahamCreations.connect(deployer).setTiers(tiers);

      // No stake = tier 0
      let [maxB, maxC] = await abrahamCreations.getUserTier(user1.address);
      expect(maxB).to.equal(1);
      expect(maxC).to.equal(0);

      // Stake 100 = tier 1
      await stake(user1, token, staking, ethers.parseEther("100"));
      [maxB, maxC] = await abrahamCreations.getUserTier(user1.address);
      expect(maxB).to.equal(5);
      expect(maxC).to.equal(2);

      // Stake 900 more = tier 2
      await stake(user1, token, staking, ethers.parseEther("900"));
      [maxB, maxC] = await abrahamCreations.getUserTier(user1.address);
      expect(maxB).to.equal(10);
      expect(maxC).to.equal(5);
    });
  });
});
