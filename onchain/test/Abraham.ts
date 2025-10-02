// test/Abraham.staking.spec.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

/* ---------------------------------------------------------- */
/* BIGINT HELPERS                                              */
/* ---------------------------------------------------------- */
function toBI(v: any): bigint {
  if (typeof v === "bigint") return v;
  if (v && typeof v.toBigInt === "function") return v.toBigInt();
  return BigInt(v.toString());
}

/* ---------------------------------------------------------- */
/* FIXTURE                                                     */
/* ---------------------------------------------------------- */
async function deployFixture() {
  const [deployer, user1, user2] = await ethers.getSigners();

  // 1) Deploy ERC20
  const Token = await ethers.getContractFactory("AbrahamToken", deployer);
  const token = await Token.deploy();
  await token.waitForDeployment();

  // 2) Deploy Staking
  const Staking = await ethers.getContractFactory("AbrahamStaking", deployer);
  const staking = await Staking.deploy(await token.getAddress());
  await staking.waitForDeployment();

  // 3) Deploy Abraham
  const Abraham = await ethers.getContractFactory("Abraham", deployer);
  const abraham = await Abraham.deploy(await staking.getAddress());
  await abraham.waitForDeployment();

  // give test tokens
  const e18 = 10n ** 18n;
  const give = 100_000n * e18;
  await (await token.transfer(user1.address, give)).wait();
  await (await token.transfer(user2.address, give)).wait();

  const N = toBI(await abraham.praiseRequirement()); // default 10e18
  const X = toBI(await abraham.blessRequirement()); // default 20e18

  return { deployer, user1, user2, token, staking, abraham, N, X, e18 };
}

/* helper ids */
const S1 = "session-aaa";
const M1 = "msg-0001";
const M2 = "msg-0002";
const M3 = "msg-0003";
const M4 = "msg-0004";

const B1 = "bless-01";
const B2 = "bless-02";
const B3 = "bless-03";

// extra ids for cross-session batch tests
const SA = "session-A";
const SB = "session-B";
const SC = "session-C";
const MA0 = "msg-A0";
const MB0 = "msg-B0";
const MC0 = "msg-C0";
const MA1 = "msg-A1";
const MB1 = "msg-B1";

/* sample CIDs */
const CID_A = "ipfs://cid-a";
const CID_B = "ipfs://cid-b";
const CID_C = "ipfs://cid-c";
const CID_D = "ipfs://cid-d";
const CID_E = "ipfs://cid-e";
const CID_F = "ipfs://cid-f";
const CID_G = "ipfs://cid-g";

/* ---------------------------------------------------------- */
/* UTIL HELPERS                                                */
/* ---------------------------------------------------------- */
function encSession(sessionId: string): string {
  const coder = ethers.AbiCoder.defaultAbiCoder();
  return coder.encode(["string"], [sessionId]);
}

async function stakeViaTransferAndCall(
  user: any,
  token: any,
  staking: any,
  sessionId: string,
  amount: bigint
) {
  await (
    await token
      .connect(user)
      .transferAndCall(
        await staking.getAddress(),
        amount,
        encSession(sessionId)
      )
  ).wait();
}

/* ---------------------------------------------------------- */
/* TESTS                                                       */
/* ---------------------------------------------------------- */
describe("Abraham (staking-gated, send-only staking)", () => {
  /* ----------------------- deploy ------------------------ */
  it("sets deployer as owner", async () => {
    const { abraham, deployer } = await loadFixture(deployFixture);
    expect(await abraham.owner()).to.equal(deployer.address);
  });

  /* ------------------ session creation ------------------- */
  describe("createSession", () => {
    it("owner can create a session with the first message CID", async () => {
      const { abraham } = await loadFixture(deployFixture);

      await expect(abraham.createSession(S1, M1, CID_A))
        .to.emit(abraham, "SessionCreated")
        .withArgs(S1);

      const ids = await abraham.getMessageIds(S1);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(M1);

      const [author, cid, praises] = await abraham.getMessage(S1, M1);
      expect(cid).to.equal(CID_A);
      expect(author).to.equal(await abraham.owner());
      expect(praises).to.equal(0);
      expect(await abraham.isSessionClosed(S1)).to.equal(false);

      const [mc, tb, tp, closed] = await abraham.getSessionStats(S1);
      expect(mc).to.equal(1);
      expect(tb).to.equal(0);
      expect(tp).to.equal(0);
      expect(closed).to.equal(false);
    });

    it("reverts if CID is empty", async () => {
      const { abraham } = await loadFixture(deployFixture);
      await expect(
        abraham.createSession("empty-session", "m0", "")
      ).to.be.revertedWith("CID required");
    });

    it("reverts if non-owner calls", async () => {
      const { abraham, user1 } = await loadFixture(deployFixture);
      await expect(abraham.connect(user1).createSession(S1, M1, CID_A))
        .to.be.revertedWithCustomError(abraham, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });

    it("reverts on duplicate session id", async () => {
      const { abraham } = await loadFixture(deployFixture);
      await abraham.createSession(S1, M1, CID_A);
      await expect(
        abraham.createSession(S1, "msg-dup", CID_B)
      ).to.be.revertedWith("Session exists");
    });
  });

  /* ------------------ abrahamUpdate ---------------------- */
  describe("abrahamUpdate", () => {
    it("owner can append a message (CID) while keeping session open", async () => {
      const { abraham } = await loadFixture(deployFixture);

      await abraham.createSession(S1, M1, CID_A);

      await expect(abraham.abrahamUpdate(S1, M2, CID_B, false)).to.emit(
        abraham,
        "MessageAdded"
      );

      const ids = await abraham.getMessageIds(S1);
      expect(ids.length).to.equal(2);

      const [, cid] = await abraham.getMessage(S1, M2);
      expect(cid).to.equal(CID_B);
      expect(await abraham.isSessionClosed(S1)).to.equal(false);

      const [mc, tb, tp, closed] = await abraham.getSessionStats(S1);
      expect(mc).to.equal(2);
      expect(tb).to.equal(0);
      expect(tp).to.equal(0);
      expect(closed).to.equal(false);
    });

    it("owner can close and later reopen the session", async () => {
      const { abraham, user1, token, staking, X } = await loadFixture(
        deployFixture
      );

      await abraham.createSession(S1, M1, CID_A);
      await expect(abraham.abrahamUpdate(S1, M2, CID_B, true)).to.emit(
        abraham,
        "SessionClosed"
      );
      expect(await abraham.isSessionClosed(S1)).to.equal(true);

      // Stake while closed (still recorded)
      await stakeViaTransferAndCall(user1, token, staking, S1, X);

      await expect(
        abraham.connect(user1).bless(S1, B1, CID_C)
      ).to.be.revertedWith("Session closed");
      await expect(abraham.connect(user1).praise(S1, M1)).to.be.revertedWith(
        "Session closed"
      );

      await expect(abraham.abrahamUpdate(S1, M3, CID_D, false)).to.emit(
        abraham,
        "SessionReopened"
      );
      expect(await abraham.isSessionClosed(S1)).to.equal(false);

      await expect(abraham.connect(user1).bless(S1, B2, CID_E)).to.emit(
        abraham,
        "MessageAdded"
      );
      await expect(abraham.connect(user1).praise(S1, M1)).to.be.revertedWith(
        "insufficient stake for praise"
      );

      const [mc, tb, tp, closed] = await abraham.getSessionStats(S1);
      expect(mc).to.equal(4);
      expect(tb).to.equal(1);
      expect(tp).to.equal(0);
      expect(closed).to.equal(false);
    });

    it("reverts when CID is empty", async () => {
      const { abraham } = await loadFixture(deployFixture);
      await abraham.createSession(S1, M1, CID_A);
      await expect(abraham.abrahamUpdate(S1, M2, "", false)).to.be.revertedWith(
        "CID required"
      );
    });
  });

  /* ---------------------- bless -------------------------- */
  describe("bless (capacity-gated)", () => {
    it("requires per-session stake capacity and increments totals", async () => {
      const { abraham, user1, token, staking, X } = await loadFixture(
        deployFixture
      );

      await abraham.createSession(S1, M1, CID_A);

      await expect(
        abraham.connect(user1).bless(S1, B1, CID_B)
      ).to.be.revertedWith("insufficient stake for bless");

      await stakeViaTransferAndCall(user1, token, staking, S1, X);

      await expect(abraham.connect(user1).bless(S1, B1, CID_B)).to.emit(
        abraham,
        "MessageAdded"
      );

      const ids = await abraham.getMessageIds(S1);
      expect(ids.length).to.equal(2);

      const [author, cid] = await abraham.getMessage(S1, B1);
      expect(author).to.equal(user1.address);
      expect(cid).to.equal(CID_B);

      const [mc, tb, tp] = await abraham.getSessionStats(S1);
      expect(mc).to.equal(2);
      expect(tb).to.equal(1);
      expect(tp).to.equal(0);

      await expect(
        abraham.connect(user1).bless(S1, B2, CID_C)
      ).to.be.revertedWith("insufficient stake for bless");
    });

    it("fails for unknown session or empty CID", async () => {
      const { abraham, user1, token, staking, X } = await loadFixture(
        deployFixture
      );
      await stakeViaTransferAndCall(user1, token, staking, "ghost", X); // staking accepts, but Abraham checks existence
      await expect(
        abraham.connect(user1).bless("ghost", B1, CID_B)
      ).to.be.revertedWith("Session not found");

      await abraham.createSession(S1, M1, CID_A);
      await expect(abraham.connect(user1).bless(S1, B1, "")).to.be.revertedWith(
        "CID required"
      );
    });
  });

  /* ---------------------- praise ------------------------- */
  describe("praise (capacity-gated)", () => {
    it("user can praise multiple times if stake covers total required", async () => {
      const { abraham, user1, token, staking, N } = await loadFixture(
        deployFixture
      );

      await abraham.createSession(S1, M1, CID_A);
      await stakeViaTransferAndCall(user1, token, staking, S1, 2n * N);

      await expect(abraham.connect(user1).praise(S1, M1)).to.emit(
        abraham,
        "Praised"
      );

      let [, , pc] = await abraham.getMessage(S1, M1);
      expect(pc).to.equal(1);

      await expect(abraham.connect(user1).praise(S1, M1)).to.emit(
        abraham,
        "Praised"
      );

      [, , pc] = await abraham.getMessage(S1, M1);
      expect(pc).to.equal(2);

      const [, , tp] = await abraham.getSessionStats(S1);
      expect(tp).to.equal(2);

      await expect(abraham.connect(user1).praise(S1, M1)).to.be.revertedWith(
        "insufficient stake for praise"
      );
    });

    it("fails for unknown message", async () => {
      const { abraham, user1, token, staking, N } = await loadFixture(
        deployFixture
      );
      await abraham.createSession(S1, M1, CID_A);
      await stakeViaTransferAndCall(user1, token, staking, S1, N);
      await expect(
        abraham.connect(user1).praise(S1, "ghost-msg")
      ).to.be.revertedWith("Message not found");
    });
  });

  /* ---------------------- batchPraise -------------------- */
  describe("batchPraise (capacity-gated)", () => {
    it("praises multiple messages atomically if total capacity sufficient", async () => {
      const { abraham, user1, token, staking, N } = await loadFixture(
        deployFixture
      );

      await abraham.createSession(S1, M1, CID_A);
      await abraham.abrahamUpdate(S1, M2, CID_B, false);

      await stakeViaTransferAndCall(user1, token, staking, S1, 2n * N);

      await expect(abraham.connect(user1).batchPraise(S1, [M1, M2])).to.emit(
        abraham,
        "Praised"
      );

      let [, , pc1] = await abraham.getMessage(S1, M1);
      let [, , pc2] = await abraham.getMessage(S1, M2);
      expect(pc1).to.equal(1);
      expect(pc2).to.equal(1);

      const [, , tp] = await abraham.getSessionStats(S1);
      expect(tp).to.equal(2);
    });

    it("reverts on closed session or unknown message", async () => {
      const { abraham, user1, token, staking, N } = await loadFixture(
        deployFixture
      );

      await abraham.createSession(S1, M1, CID_A);
      await abraham.abrahamUpdate(S1, M2, CID_B, true); // close

      await stakeViaTransferAndCall(user1, token, staking, S1, 2n * N);

      await expect(
        abraham.connect(user1).batchPraise(S1, [M1, M2])
      ).to.be.revertedWith("Session closed");

      await abraham.abrahamUpdate(S1, M3, CID_C, false);

      await expect(
        abraham.connect(user1).batchPraise(S1, [M1, "ghost"])
      ).to.be.revertedWith("Message not found");

      let [, , pc] = await abraham.getMessage(S1, M1);
      expect(pc).to.equal(0);
    });

    it("reverts if capacity insufficient for the whole batch", async () => {
      const { abraham, user1, token, staking, N } = await loadFixture(
        deployFixture
      );
      await abraham.createSession(S1, M1, CID_A);
      await abraham.abrahamUpdate(S1, M2, CID_B, false);

      await stakeViaTransferAndCall(user1, token, staking, S1, N); // only 1 praise worth
      await expect(
        abraham.connect(user1).batchPraise(S1, [M1, M2])
      ).to.be.revertedWith("insufficient stake for batch praise");
    });
  });

  /* ---------------------- batchBless --------------------- */
  describe("batchBless (capacity-gated)", () => {
    it("blesses multiple messages atomically when capacity allows", async () => {
      const { abraham, user1, token, staking, X } = await loadFixture(
        deployFixture
      );

      await abraham.createSession(S1, M1, CID_A);

      await stakeViaTransferAndCall(user1, token, staking, S1, 2n * X);

      await expect(
        abraham.connect(user1).batchBless(S1, [B1, B2], [CID_B, CID_C])
      ).to.emit(abraham, "MessageAdded");

      const ids = await abraham.getMessageIds(S1);
      expect(ids.length).to.equal(3);

      const [a1, cid1] = await abraham.getMessage(S1, B1);
      const [a2, cid2] = await abraham.getMessage(S1, B2);
      expect(a1).to.equal(user1.address);
      expect(a2).to.equal(user1.address);
      expect(cid1).to.equal(CID_B);
      expect(cid2).to.equal(CID_C);

      const [mc, tb] = await abraham.getSessionStats(S1);
      expect(mc).to.equal(3);
      expect(tb).to.equal(2);
    });

    it("reverts on closed session, length mismatch, empty CID, duplicate id, or insufficient capacity", async () => {
      const { abraham, user1, token, staking, X } = await loadFixture(
        deployFixture
      );

      await abraham.createSession(S1, M1, CID_A);
      await abraham.abrahamUpdate(S1, M2, CID_B, true);

      await stakeViaTransferAndCall(user1, token, staking, S1, X);

      await expect(
        abraham.connect(user1).batchBless(S1, [B1], [CID_C])
      ).to.be.revertedWith("Session closed");

      await abraham.abrahamUpdate(S1, M3, CID_D, false);

      await expect(
        abraham.connect(user1).batchBless(S1, [B1, B2], [CID_E])
      ).to.be.revertedWith("Length mismatch");

      await expect(
        abraham.connect(user1).batchBless(S1, [B1], [""])
      ).to.be.revertedWith("CID required");

      await expect(
        abraham.connect(user1).batchBless(S1, [B1, B2], [CID_E, CID_F])
      ).to.be.revertedWith("insufficient stake for batch bless");

      await expect(
        abraham.connect(user1).batchBless(S1, [B1], [CID_E])
      ).to.emit(abraham, "MessageAdded");

      await expect(
        abraham.connect(user1).batchBless(S1, [B1], [CID_F])
      ).to.be.revertedWith("Message exists");
    });
  });

  /* ------------- abrahamBatchUpdate (single session) ------------- */
  describe("abrahamBatchUpdate", () => {
    it("owner posts multiple messages (CIDs) and toggles closed state", async () => {
      const { abraham } = await loadFixture(deployFixture);

      await abraham.createSession("s-batch", "m0", CID_A);

      await expect(
        abraham.abrahamBatchUpdate(
          "s-batch",
          [
            { messageId: "m1", cid: CID_B },
            { messageId: "m2", cid: CID_C },
            { messageId: "m3", cid: CID_D },
          ],
          true
        )
      ).to.emit(abraham, "SessionClosed");

      const ids = await abraham.getMessageIds("s-batch");
      expect(ids).to.deep.equal(["m0", "m1", "m2", "m3"]);
      expect(await abraham.isSessionClosed("s-batch")).to.equal(true);

      const [, cid1] = await abraham.getMessage("s-batch", "m1");
      const [, cid2] = await abraham.getMessage("s-batch", "m2");
      const [, cid3] = await abraham.getMessage("s-batch", "m3");
      expect(cid1).to.equal(CID_B);
      expect(cid2).to.equal(CID_C);
      expect(cid3).to.equal(CID_D);
    });

    it("reverts on empty items, duplicate message id, or empty CID", async () => {
      const { abraham } = await loadFixture(deployFixture);

      await abraham.createSession("s2", "m0", CID_A);

      await expect(
        abraham.abrahamBatchUpdate("s2", [], false)
      ).to.be.revertedWith("No items");

      await abraham.abrahamUpdate("s2", "x1", CID_B, false);

      await expect(
        abraham.abrahamBatchUpdate(
          "s2",
          [{ messageId: "x1", cid: CID_C }],
          false
        )
      ).to.be.revertedWith("Message exists");

      await expect(
        abraham.abrahamBatchUpdate("s2", [{ messageId: "x2", cid: "" }], false)
      ).to.be.revertedWith("CID required");
    });
  });

  /* ----------------- abrahamBatchCreate (cross-session) ---------------- */
  describe("abrahamBatchCreate (cross-session)", () => {
    it("creates multiple sessions at once (each with CID)", async () => {
      const { abraham } = await loadFixture(deployFixture);

      await abraham.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, cid: CID_A },
        { sessionId: SB, firstMessageId: MB0, cid: CID_B },
      ]);

      expect(await abraham.isSessionClosed(SA)).to.equal(false);
      expect(await abraham.isSessionClosed(SB)).to.equal(false);

      let idsA = await abraham.getMessageIds(SA);
      let idsB = await abraham.getMessageIds(SB);
      expect(idsA).to.deep.equal([MA0]);
      expect(idsB).to.deep.equal([MB0]);

      const [, cidA] = await abraham.getMessage(SA, MA0);
      const [, cidB] = await abraham.getMessage(SB, MB0);
      expect(cidA).to.equal(CID_A);
      expect(cidB).to.equal(CID_B);

      const total = await abraham.sessionTotal();
      expect(toBI(total)).to.equal(2n);
    });

    it("reverts for duplicate session, per-session message uniqueness, and empty CID", async () => {
      const { abraham } = await loadFixture(deployFixture);

      await abraham.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, cid: CID_A },
      ]);

      await expect(
        abraham.abrahamBatchCreate([
          { sessionId: SA, firstMessageId: "new", cid: CID_B },
        ])
      ).to.be.revertedWith("Session exists");

      await expect(
        abraham.abrahamBatchCreate([
          { sessionId: SB, firstMessageId: MA0, cid: CID_C },
        ])
      ).to.not.be.reverted;

      await expect(
        abraham.abrahamBatchCreate([
          { sessionId: SC, firstMessageId: MC0, cid: "" },
        ])
      ).to.be.revertedWith("CID required");
    });
  });

  /* ------ abrahamBatchUpdateAcrossSessions (cross-session) ------ */
  describe("abrahamBatchUpdateAcrossSessions", () => {
    it("adds one owner message (CID) to each target session and keeps closed state unchanged when closed=false is provided", async () => {
      const { abraham } = await loadFixture(deployFixture);

      await abraham.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, cid: CID_A },
        { sessionId: SB, firstMessageId: MB0, cid: CID_B },
      ]);

      await expect(
        abraham.abrahamBatchUpdateAcrossSessions([
          { sessionId: SA, messageId: MA1, cid: CID_C, closed: false },
          { sessionId: SB, messageId: MB1, cid: CID_D, closed: false },
        ])
      ).to.emit(abraham, "MessageAdded");

      const idsA = await abraham.getMessageIds(SA);
      const idsB = await abraham.getMessageIds(SB);
      expect(idsA).to.deep.equal([MA0, MA1]);
      expect(idsB).to.deep.equal([MB0, MB1]);

      const [, cidA1] = await abraham.getMessage(SA, MA1);
      const [, cidB1] = await abraham.getMessage(SB, MB1);
      expect(cidA1).to.equal(CID_C);
      expect(cidB1).to.equal(CID_D);

      expect(await abraham.isSessionClosed(SA)).to.equal(false);
      expect(await abraham.isSessionClosed(SB)).to.equal(false);
    });

    it("can close or reopen sessions per item", async () => {
      const { abraham } = await loadFixture(deployFixture);

      await abraham.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, cid: CID_A },
        { sessionId: SB, firstMessageId: MB0, cid: CID_B },
      ]);

      await expect(
        abraham.abrahamBatchUpdateAcrossSessions([
          { sessionId: SA, messageId: "sa-close", cid: CID_C, closed: true },
          { sessionId: SB, messageId: "sb-open", cid: CID_D, closed: false },
        ])
      ).to.emit(abraham, "SessionClosed");

      expect(await abraham.isSessionClosed(SA)).to.equal(true);
      expect(await abraham.isSessionClosed(SB)).to.equal(false);

      await expect(
        abraham.abrahamBatchUpdateAcrossSessions([
          { sessionId: SA, messageId: "sa-reopen", cid: CID_E, closed: false },
        ])
      ).to.emit(abraham, "SessionReopened");

      expect(await abraham.isSessionClosed(SA)).to.equal(false);
    });

    it("reverts on unknown session, duplicate message id in that session, or empty CID", async () => {
      const { abraham } = await loadFixture(deployFixture);

      await abraham.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, cid: CID_A },
      ]);

      await expect(
        abraham.abrahamBatchUpdateAcrossSessions([
          { sessionId: "ghost", messageId: "m-x", cid: CID_B, closed: false },
        ])
      ).to.be.revertedWith("Session not found");

      await expect(
        abraham.abrahamBatchUpdateAcrossSessions([
          { sessionId: SA, messageId: MA0, cid: CID_C, closed: false },
        ])
      ).to.be.revertedWith("Message exists");

      await expect(
        abraham.abrahamBatchUpdateAcrossSessions([
          { sessionId: SA, messageId: "new", cid: "", closed: false },
        ])
      ).to.be.revertedWith("CID required");
    });
  });

  /* ---------------------- curation points ---------------- */
  describe("curation points (time-weighted stake)", () => {
    it("accrues amount * time per session, persists over time", async () => {
      const { token, staking, user1, abraham, N } = await loadFixture(
        deployFixture
      );

      await abraham.createSession(S1, M1, CID_A);

      await stakeViaTransferAndCall(user1, token, staking, S1, N);

      const before = await staking.currentPoints(user1.address, S1);
      expect(toBI(before)).to.equal(0n);

      await time.increase(24 * 60 * 60);

      const after = await staking.currentPoints(user1.address, S1);
      const expected = toBI(N) * 86400n;
      expect(toBI(after)).to.equal(expected);
    });
  });

  /* ------------------ permanence on unstake --------------- */
  describe("actions permanence after unstake", () => {
    it("praises & blessings persist even if user unstakes later", async () => {
      const { abraham, staking, token, user1, N, X } = await loadFixture(
        deployFixture
      );

      await abraham.createSession(S1, M1, CID_A);

      await stakeViaTransferAndCall(user1, token, staking, S1, X + N);

      await expect(abraham.connect(user1).bless(S1, B1, CID_B)).to.emit(
        abraham,
        "MessageAdded"
      );
      await expect(abraham.connect(user1).praise(S1, M1)).to.emit(
        abraham,
        "Praised"
      );

      await (await staking.connect(user1).unstake(S1, X + N)).wait();

      const [mc, tb, tp] = await abraham.getSessionStats(S1);
      expect(mc).to.equal(2); // M1 + B1
      expect(tb).to.equal(1);
      expect(tp).to.equal(1);

      await expect(abraham.connect(user1).praise(S1, M1)).to.be.revertedWith(
        "insufficient stake for praise"
      );
      await expect(
        abraham.connect(user1).bless(S1, B2, CID_C)
      ).to.be.revertedWith("insufficient stake for bless");
    });
  });

  /* ------------------ admin: setRequirements -------------- */
  describe("setRequirements (admin)", () => {
    it("owner can update N and X and capacity reflects changes", async () => {
      const { abraham, deployer, user1, token, staking, e18 } =
        await loadFixture(deployFixture);

      await abraham.createSession(S1, M1, CID_A);

      await (
        await abraham.connect(deployer).setRequirements(5n * e18, 7n * e18)
      ).wait();

      const N2 = toBI(await abraham.praiseRequirement());
      const X2 = toBI(await abraham.blessRequirement());
      expect(N2).to.equal(5n * e18);
      expect(X2).to.equal(7n * e18);

      await stakeViaTransferAndCall(user1, token, staking, S1, 12n * e18);

      await expect(abraham.connect(user1).praise(S1, M1)).to.emit(
        abraham,
        "Praised"
      );
      await expect(abraham.connect(user1).bless(S1, B1, CID_B)).to.emit(
        abraham,
        "MessageAdded"
      );

      await expect(abraham.connect(user1).praise(S1, M1)).to.be.revertedWith(
        "insufficient stake for praise"
      );
    });

    it("non-owner cannot update requirements", async () => {
      const { abraham, user1 } = await loadFixture(deployFixture);
      await expect(
        abraham.connect(user1).setRequirements(1, 1)
      ).to.be.revertedWithCustomError(abraham, "OwnableUnauthorizedAccount");
    });
  });
});
