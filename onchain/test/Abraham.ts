// test/Abraham.cid.spec.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Abraham } from "../typechain-types";

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
  const [abraham, user1, user2] = await ethers.getSigners();
  const AbrahamFactory = await ethers.getContractFactory("Abraham", abraham);
  const contract = (await AbrahamFactory.deploy()) as Abraham;

  const PRAISE_PRICE = await contract.PRAISE_PRICE();
  const BLESS_PRICE = await contract.BLESS_PRICE();

  return { contract, abraham, user1, user2, PRAISE_PRICE, BLESS_PRICE };
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
/* TESTS                                                       */
/* ---------------------------------------------------------- */
describe("Abraham (CID-only: content/media moved to IPFS JSON)", () => {
  /* ----------------------- deploy ------------------------ */
  it("sets deployer as owner", async () => {
    const { contract, abraham } = await loadFixture(deployFixture);
    expect(await contract.owner()).to.equal(abraham.address);
  });

  /* ------------------ session creation ------------------- */
  describe("createSession", () => {
    it("owner can create a session with the first message CID", async () => {
      const { contract } = await loadFixture(deployFixture);

      await expect(contract.createSession(S1, M1, CID_A))
        .to.emit(contract, "SessionCreated")
        .withArgs(S1);

      const ids = await contract.getMessageIds(S1);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(M1);

      const [author, cid, praises] = await contract.getMessage(S1, M1);
      expect(cid).to.equal(CID_A);
      expect(author).to.equal(await contract.owner());
      expect(praises).to.equal(0);
      expect(await contract.isSessionClosed(S1)).to.equal(false);

      const [mc, tb, tp, closed] = await contract.getSessionStats(S1);
      expect(mc).to.equal(1);
      expect(tb).to.equal(0);
      expect(tp).to.equal(0);
      expect(closed).to.equal(false);
    });

    it("reverts if CID is empty", async () => {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.createSession("empty-session", "m0", "")
      ).to.be.revertedWith("CID required");
    });

    it("reverts if non-owner calls", async () => {
      const { contract, user1 } = await loadFixture(deployFixture);

      await expect(contract.connect(user1).createSession(S1, M1, CID_A))
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });

    it("reverts on duplicate session id", async () => {
      const { contract } = await loadFixture(deployFixture);

      await contract.createSession(S1, M1, CID_A);

      await expect(
        contract.createSession(S1, "msg-dup", CID_B)
      ).to.be.revertedWith("Session exists");
    });
  });

  /* ------------------ abrahamUpdate ---------------------- */
  describe("abrahamUpdate", () => {
    it("owner can append a message (CID) while keeping session open", async () => {
      const { contract } = await loadFixture(deployFixture);

      await contract.createSession(S1, M1, CID_A);

      await expect(contract.abrahamUpdate(S1, M2, CID_B, false)).to.emit(
        contract,
        "MessageAdded"
      );

      const ids = await contract.getMessageIds(S1);
      expect(ids.length).to.equal(2);

      const [, cid] = await contract.getMessage(S1, M2);
      expect(cid).to.equal(CID_B);
      expect(await contract.isSessionClosed(S1)).to.equal(false);

      const [mc, tb, tp, closed] = await contract.getSessionStats(S1);
      expect(mc).to.equal(2);
      expect(tb).to.equal(0);
      expect(tp).to.equal(0);
      expect(closed).to.equal(false);
    });

    it("owner can close and later reopen the session", async () => {
      const { contract, user1, PRAISE_PRICE, BLESS_PRICE } = await loadFixture(
        deployFixture
      );

      /* create and then CLOSE */
      await contract.createSession(S1, M1, CID_A);

      await expect(contract.abrahamUpdate(S1, M2, CID_B, true)).to.emit(
        contract,
        "SessionClosed"
      );
      expect(await contract.isSessionClosed(S1)).to.equal(true);

      /* bless / praise should revert while closed */
      await expect(
        contract.connect(user1).bless(S1, B1, CID_C, { value: BLESS_PRICE })
      ).to.be.revertedWith("Session closed");
      await expect(
        contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE })
      ).to.be.revertedWith("Session closed");

      /* now REOPEN with another owner update */
      await expect(contract.abrahamUpdate(S1, M3, CID_D, false)).to.emit(
        contract,
        "SessionReopened"
      );
      expect(await contract.isSessionClosed(S1)).to.equal(false);

      /* bless / praise succeed again */
      await contract
        .connect(user1)
        .bless(S1, B2, CID_E, { value: BLESS_PRICE });
      await contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE });

      const [mc, tb, tp, closed] = await contract.getSessionStats(S1);
      expect(mc).to.equal(4); // M1, M2, M3, B2
      expect(tb).to.equal(1); // one user blessing
      expect(tp).to.equal(1); // one praise
      expect(closed).to.equal(false);
    });

    it("reverts when CID is empty", async () => {
      const { contract } = await loadFixture(deployFixture);

      await contract.createSession(S1, M1, CID_A);

      await expect(
        contract.abrahamUpdate(S1, M2, "", false)
      ).to.be.revertedWith("CID required");
    });
  });

  /* ---------------------- bless -------------------------- */
  describe("bless", () => {
    it("user can bless with exact fee (CID required) and increments totalBlessings", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);

      await contract.createSession(S1, M1, CID_A);

      await expect(
        contract.connect(user1).bless(S1, B1, CID_B, { value: BLESS_PRICE })
      ).to.emit(contract, "MessageAdded");

      const ids = await contract.getMessageIds(S1);
      expect(ids.length).to.equal(2);

      const [author, cid] = await contract.getMessage(S1, B1);
      expect(author).to.equal(user1.address);
      expect(cid).to.equal(CID_B);

      const [mc, tb, tp] = await contract.getSessionStats(S1);
      expect(mc).to.equal(2);
      expect(tb).to.equal(1);
      expect(tp).to.equal(0);
    });

    it("fails with wrong fee or empty CID", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);

      await contract.createSession(S1, M1, CID_A);

      await expect(
        contract
          .connect(user1)
          .bless(S1, B1, CID_B, { value: BLESS_PRICE - 1n })
      ).to.be.revertedWith("Incorrect ETH");

      await expect(
        contract.connect(user1).bless(S1, B1, "", { value: BLESS_PRICE })
      ).to.be.revertedWith("CID required");
    });

    it("fails for unknown session", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);

      await expect(
        contract
          .connect(user1)
          .bless("ghost", B1, CID_B, { value: BLESS_PRICE })
      ).to.be.revertedWith("Session not found");
    });
  });

  /* ---------------------- praise ------------------------- */
  describe("praise", () => {
    it("user can praise multiple times; each praise costs fee and increments totals", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );

      await contract.createSession(S1, M1, CID_A);

      /* first praise */
      await expect(
        contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE })
      ).to.emit(contract, "Praised");

      let [, , pc] = await contract.getMessage(S1, M1);
      expect(pc).to.equal(1);

      /* second praise by SAME user */
      await expect(
        contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE })
      ).to.emit(contract, "Praised");

      [, , pc] = await contract.getMessage(S1, M1);
      expect(pc).to.equal(2);

      const [, , tp] = await contract.getSessionStats(S1);
      expect(tp).to.equal(2);
    });

    it("fails with wrong fee or unknown message", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );

      await contract.createSession(S1, M1, CID_A);

      await expect(
        contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE - 1n })
      ).to.be.revertedWith("Incorrect ETH");

      await expect(
        contract.connect(user1).praise(S1, "ghost-msg", { value: PRAISE_PRICE })
      ).to.be.revertedWith("Message not found");
    });
  });

  /* ---------------------- batchPraise -------------------- */
  describe("batchPraise", () => {
    it("praises multiple messages atomically with exact total fee", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );

      await contract.createSession(S1, M1, CID_A);
      await contract.abrahamUpdate(S1, M2, CID_B, false);

      await expect(
        contract.connect(user1).batchPraise(S1, [M1, M2], {
          value: PRAISE_PRICE * 2n,
        })
      ).to.emit(contract, "Praised");

      let [, , pc1] = await contract.getMessage(S1, M1);
      let [, , pc2] = await contract.getMessage(S1, M2);
      expect(pc1).to.equal(1);
      expect(pc2).to.equal(1);

      const [, , tp] = await contract.getSessionStats(S1);
      expect(tp).to.equal(2);
    });

    it("reverts on incorrect ETH or closed session", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );

      await contract.createSession(S1, M1, CID_A);
      await contract.abrahamUpdate(S1, M2, CID_B, true); // close

      await expect(
        contract.connect(user1).batchPraise(S1, [M1, M2], {
          value: PRAISE_PRICE * 2n,
        })
      ).to.be.revertedWith("Session closed");

      // reopen to test ETH mismatch
      await contract.abrahamUpdate(S1, M3, CID_C, false);

      await expect(
        contract.connect(user1).batchPraise(S1, [M1, M2], {
          value: PRAISE_PRICE, // wrong
        })
      ).to.be.revertedWith("Incorrect ETH");
    });

    it("reverts if any message is unknown (atomicity check)", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );

      await contract.createSession(S1, M1, CID_A);

      await expect(
        contract.connect(user1).batchPraise(S1, [M1, "ghost"], {
          value: PRAISE_PRICE * 2n,
        })
      ).to.be.revertedWith("Message not found");

      // Verify no partial praise happened
      let [, , pc] = await contract.getMessage(S1, M1);
      expect(pc).to.equal(0);
    });
  });

  /* ---------------------- batchBless --------------------- */
  describe("batchBless", () => {
    it("blesses multiple messages atomically with exact total fee", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);

      await contract.createSession(S1, M1, CID_A);

      await expect(
        contract.connect(user1).batchBless(S1, [B1, B2], [CID_B, CID_C], {
          value: BLESS_PRICE * 2n,
        })
      ).to.emit(contract, "MessageAdded");

      const ids = await contract.getMessageIds(S1);
      expect(ids.length).to.equal(3);

      const [a1, cid1] = await contract.getMessage(S1, B1);
      const [a2, cid2] = await contract.getMessage(S1, B2);
      expect(a1).to.equal(user1.address);
      expect(a2).to.equal(user1.address);
      expect(cid1).to.equal(CID_B);
      expect(cid2).to.equal(CID_C);

      const [mc, tb] = await contract.getSessionStats(S1);
      expect(mc).to.equal(3);
      expect(tb).to.equal(2);
    });

    it("reverts on closed session, length mismatch, empty CID, or duplicate id", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);

      await contract.createSession(S1, M1, CID_A);
      await contract.abrahamUpdate(S1, M2, CID_B, true);

      await expect(
        contract
          .connect(user1)
          .batchBless(S1, [B1], [CID_C], { value: BLESS_PRICE })
      ).to.be.revertedWith("Session closed");

      // reopen
      await contract.abrahamUpdate(S1, M3, CID_D, false);

      await expect(
        contract
          .connect(user1)
          .batchBless(S1, [B1, B2], [CID_E], { value: BLESS_PRICE * 2n })
      ).to.be.revertedWith("Length mismatch");

      // empty CID
      await expect(
        contract
          .connect(user1)
          .batchBless(S1, [B1], [""], { value: BLESS_PRICE })
      ).to.be.revertedWith("CID required");

      // create B1 once, then attempt duplicate
      await contract
        .connect(user1)
        .batchBless(S1, [B1], [CID_E], { value: BLESS_PRICE });

      await expect(
        contract
          .connect(user1)
          .batchBless(S1, [B1], [CID_F], { value: BLESS_PRICE })
      ).to.be.revertedWith("Message exists");
    });
  });

  /* ------------- abrahamBatchUpdate (single session) ------------- */
  describe("abrahamBatchUpdate", () => {
    it("owner posts multiple messages (CIDs) and toggles closed state", async () => {
      const { contract } = await loadFixture(deployFixture);

      await contract.createSession("s-batch", "m0", CID_A);

      await expect(
        contract.abrahamBatchUpdate(
          "s-batch",
          [
            { messageId: "m1", cid: CID_B },
            { messageId: "m2", cid: CID_C },
            { messageId: "m3", cid: CID_D },
          ],
          true
        )
      ).to.emit(contract, "SessionClosed");

      const ids = await contract.getMessageIds("s-batch");
      expect(ids).to.deep.equal(["m0", "m1", "m2", "m3"]);
      expect(await contract.isSessionClosed("s-batch")).to.equal(true);

      const [, cid1] = await contract.getMessage("s-batch", "m1");
      const [, cid2] = await contract.getMessage("s-batch", "m2");
      const [, cid3] = await contract.getMessage("s-batch", "m3");
      expect(cid1).to.equal(CID_B);
      expect(cid2).to.equal(CID_C);
      expect(cid3).to.equal(CID_D);
    });

    it("reverts on empty items, duplicate message id, or empty CID", async () => {
      const { contract } = await loadFixture(deployFixture);

      await contract.createSession("s2", "m0", CID_A);

      await expect(
        contract.abrahamBatchUpdate("s2", [], false)
      ).to.be.revertedWith("No items");

      // create one, then try duplicate in batch
      await contract.abrahamUpdate("s2", "x1", CID_B, false);

      await expect(
        contract.abrahamBatchUpdate(
          "s2",
          [{ messageId: "x1", cid: CID_C }],
          false
        )
      ).to.be.revertedWith("Message exists");

      // empty CID item
      await expect(
        contract.abrahamBatchUpdate("s2", [{ messageId: "x2", cid: "" }], false)
      ).to.be.revertedWith("CID required");
    });
  });

  /* ----------------- abrahamBatchCreate (cross-session) ---------------- */
  describe("abrahamBatchCreate (cross-session)", () => {
    it("creates multiple sessions at once (each with CID)", async () => {
      const { contract } = await loadFixture(deployFixture);

      await contract.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, cid: CID_A },
        { sessionId: SB, firstMessageId: MB0, cid: CID_B },
      ]);

      expect(await contract.isSessionClosed(SA)).to.equal(false);
      expect(await contract.isSessionClosed(SB)).to.equal(false);

      let idsA = await contract.getMessageIds(SA);
      let idsB = await contract.getMessageIds(SB);
      expect(idsA).to.deep.equal([MA0]);
      expect(idsB).to.deep.equal([MB0]);

      const [, cidA] = await contract.getMessage(SA, MA0);
      const [, cidB] = await contract.getMessage(SB, MB0);
      expect(cidA).to.equal(CID_A);
      expect(cidB).to.equal(CID_B);

      // sessionTotal should be 2
      const total = await contract.sessionTotal();
      expect(toBI(total)).to.equal(2n);
    });

    it("reverts for duplicate session, per-session message uniqueness, and empty CID", async () => {
      const { contract } = await loadFixture(deployFixture);

      // create one valid session first
      await contract.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, cid: CID_A },
      ]);

      // duplicate sessionId
      await expect(
        contract.abrahamBatchCreate([
          { sessionId: SA, firstMessageId: "new", cid: CID_B },
        ])
      ).to.be.revertedWith("Session exists");

      // duplicate messageId name reused in another session is fine (uniqueness is per-session)
      await expect(
        contract.abrahamBatchCreate([
          { sessionId: SB, firstMessageId: MA0, cid: CID_C },
        ])
      ).to.not.be.reverted;

      // empty CID
      await expect(
        contract.abrahamBatchCreate([
          { sessionId: SC, firstMessageId: MC0, cid: "" },
        ])
      ).to.be.revertedWith("CID required");
    });
  });

  /* ------ abrahamBatchUpdateAcrossSessions (cross-session) ------ */
  describe("abrahamBatchUpdateAcrossSessions", () => {
    it("adds one owner message (CID) to each target session and keeps closed state unchanged when closed=false is provided", async () => {
      const { contract } = await loadFixture(deployFixture);

      // prepare two sessions (both open)
      await contract.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, cid: CID_A },
        { sessionId: SB, firstMessageId: MB0, cid: CID_B },
      ]);

      await expect(
        contract.abrahamBatchUpdateAcrossSessions([
          {
            sessionId: SA,
            messageId: MA1,
            cid: CID_C,
            closed: false,
          },
          {
            sessionId: SB,
            messageId: MB1,
            cid: CID_D,
            closed: false,
          },
        ])
      ).to.emit(contract, "MessageAdded");

      const idsA = await contract.getMessageIds(SA);
      const idsB = await contract.getMessageIds(SB);
      expect(idsA).to.deep.equal([MA0, MA1]);
      expect(idsB).to.deep.equal([MB0, MB1]);

      const [, cidA1] = await contract.getMessage(SA, MA1);
      const [, cidB1] = await contract.getMessage(SB, MB1);
      expect(cidA1).to.equal(CID_C);
      expect(cidB1).to.equal(CID_D);

      // still open
      expect(await contract.isSessionClosed(SA)).to.equal(false);
      expect(await contract.isSessionClosed(SB)).to.equal(false);
    });

    it("can close or reopen sessions per item", async () => {
      const { contract } = await loadFixture(deployFixture);

      // SA open, SB open
      await contract.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, cid: CID_A },
        { sessionId: SB, firstMessageId: MB0, cid: CID_B },
      ]);

      // Close SA, keep SB open via cross-session batch
      await expect(
        contract.abrahamBatchUpdateAcrossSessions([
          {
            sessionId: SA,
            messageId: "sa-close",
            cid: CID_C,
            closed: true,
          },
          {
            sessionId: SB,
            messageId: "sb-open",
            cid: CID_D,
            closed: false,
          },
        ])
      ).to.emit(contract, "SessionClosed");

      expect(await contract.isSessionClosed(SA)).to.equal(true);
      expect(await contract.isSessionClosed(SB)).to.equal(false);

      // Reopen SA in another call
      await expect(
        contract.abrahamBatchUpdateAcrossSessions([
          {
            sessionId: SA,
            messageId: "sa-reopen",
            cid: CID_E,
            closed: false,
          },
        ])
      ).to.emit(contract, "SessionReopened");

      expect(await contract.isSessionClosed(SA)).to.equal(false);
    });

    it("reverts on unknown session, duplicate message id in that session, or empty CID", async () => {
      const { contract } = await loadFixture(deployFixture);

      // prepare one session
      await contract.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, cid: CID_A },
      ]);

      // unknown session
      await expect(
        contract.abrahamBatchUpdateAcrossSessions([
          {
            sessionId: "ghost",
            messageId: "m-x",
            cid: CID_B,
            closed: false,
          },
        ])
      ).to.be.revertedWith("Session not found");

      // duplicate message id in SA
      await expect(
        contract.abrahamBatchUpdateAcrossSessions([
          {
            sessionId: SA,
            messageId: MA0,
            cid: CID_C,
            closed: false,
          },
        ])
      ).to.be.revertedWith("Message exists");

      // empty CID
      await expect(
        contract.abrahamBatchUpdateAcrossSessions([
          {
            sessionId: SA,
            messageId: "new",
            cid: "",
            closed: false,
          },
        ])
      ).to.be.revertedWith("CID required");
    });
  });

  /* --------------------- withdraw ------------------------ */
  describe("withdraw", () => {
    it("transfers all ETH to owner", async () => {
      const { contract, abraham, user1, PRAISE_PRICE, BLESS_PRICE } =
        await loadFixture(deployFixture);

      await contract.createSession(S1, M1, CID_A);

      await contract
        .connect(user1)
        .bless(S1, B1, CID_B, { value: BLESS_PRICE });
      await contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE });

      const before = await ethers.provider.getBalance(abraham.address);

      const tx = await contract.withdraw();
      const r = await tx.wait();

      // Coerce all arithmetic to native bigint
      const beforeBI = toBI(before);
      const afterBI = toBI(await ethers.provider.getBalance(abraham.address));
      const praiseBI = toBI(PRAISE_PRICE);
      const blessBI = toBI(BLESS_PRICE);
      const gasUsedBI = toBI(r!.gasUsed);

      // Get effective gas price from transaction response or receipt
      const effGasPriceBI = tx.gasPrice
        ? toBI(tx.gasPrice)
        : toBI(r!.gasPrice || 0);
      const gasBI = gasUsedBI * effGasPriceBI;

      expect(afterBI).to.equal(beforeBI + praiseBI + blessBI - gasBI);
    });
  });
});
