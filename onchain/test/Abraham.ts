import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Abraham } from "../typechain-types";

/* ---------------------------------------------------------- */
/*                       BIGINT HELPERS                       */
/* ---------------------------------------------------------- */
function toBI(v: any): bigint {
  if (typeof v === "bigint") return v;
  if (v && typeof v.toBigInt === "function") return v.toBigInt();
  return BigInt(v.toString());
}

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
const S1 = "session-aaa"; // simple ascii ids for clarity
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

/* ---------------------------------------------------------- */
/*                        TESTS                               */
/* ---------------------------------------------------------- */
describe("Abraham contract (overloads + user batches + owner single/cross-session batches)", () => {
  /* ----------------------- deploy ------------------------ */
  it("sets deployer as owner", async () => {
    const { contract, abraham } = await loadFixture(deployFixture);
    expect(await contract.owner()).to.equal(abraham.address);
  });

  /* ------------------ session creation ------------------- */
  describe("createSession", () => {
    it("owner can create a session with media (and optional content)", async () => {
      const { contract } = await loadFixture(deployFixture);

      await expect(
        contract["createSession(string,string,string,string)"](
          S1,
          M1,
          "first image",
          "ipfs://hashA"
        )
      )
        .to.emit(contract, "SessionCreated")
        .withArgs(S1);

      const ids = await contract.getMessageIds(S1);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(M1);

      const [author, , media] = await contract.getMessage(S1, M1);
      expect(media).to.equal("ipfs://hashA");
      expect(author).to.equal(await contract.owner());

      expect(await contract.isSessionClosed(S1)).to.equal(false);
    });

    it("owner can create a session with content-only via 4-arg (media empty)", async () => {
      const { contract } = await loadFixture(deployFixture);

      await expect(
        contract["createSession(string,string,string,string)"](
          "session-txt",
          "msg-t1",
          "hello world",
          ""
        )
      )
        .to.emit(contract, "SessionCreated")
        .withArgs("session-txt");

      const ids = await contract.getMessageIds("session-txt");
      expect(ids.length).to.equal(1);
      const [author, content, media, praises] = await contract.getMessage(
        "session-txt",
        "msg-t1"
      );
      expect(author).to.equal(await contract.owner());
      expect(content).to.equal("hello world");
      expect(media).to.equal("");
      expect(praises).to.equal(0);
    });

    it("owner can create a session with media-only (content empty) via 4-arg", async () => {
      const { contract } = await loadFixture(deployFixture);

      await expect(
        contract["createSession(string,string,string,string)"](
          "session-media",
          "msg-m1",
          "",
          "ipfs://only"
        )
      )
        .to.emit(contract, "SessionCreated")
        .withArgs("session-media");

      const [author, content, media, praises] = await contract.getMessage(
        "session-media",
        "msg-m1"
      );
      expect(author).to.equal(await contract.owner());
      expect(content).to.equal("");
      expect(media).to.equal("ipfs://only");
      expect(praises).to.equal(0);
    });

    it("owner can create a session with content-only using the 3-arg overload", async () => {
      const { contract } = await loadFixture(deployFixture);

      await expect(
        contract["createSession(string,string,string)"](
          "session-overload",
          "msg-o1",
          "just text"
        )
      )
        .to.emit(contract, "SessionCreated")
        .withArgs("session-overload");

      const [author, content, media, praises] = await contract.getMessage(
        "session-overload",
        "msg-o1"
      );
      expect(author).to.equal(await contract.owner());
      expect(content).to.equal("just text");
      expect(media).to.equal("");
      expect(praises).to.equal(0);
    });

    it("reverts if both content and media are empty (4-arg)", async () => {
      const { contract } = await loadFixture(deployFixture);

      await expect(
        contract["createSession(string,string,string,string)"](
          "empty-session",
          "msg-empty",
          "",
          ""
        )
      ).to.be.revertedWith("Empty message");
    });

    it("reverts if non-owner calls", async () => {
      const { contract, user1 } = await loadFixture(deployFixture);
      await expect(
        contract
          .connect(user1)
          ["createSession(string,string,string,string)"](
            S1,
            M1,
            "hack",
            "ipfs://bad"
          )
      )
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });

    it("reverts on duplicate session id", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "ok",
        "ipfs://y"
      );

      await expect(
        contract["createSession(string,string,string,string)"](
          S1,
          "msg-dup",
          "again",
          "ipfs://z"
        )
      ).to.be.revertedWith("Session exists");
    });
  });

  /* ------------------ abrahamUpdate ---------------------- */
  describe("abrahamUpdate", () => {
    it("owner can append an image update while keeping session open (4-arg + bool)", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "v1",
        "ipfs://a"
      );

      await expect(
        contract["abrahamUpdate(string,string,string,string,bool)"](
          S1,
          M2,
          "v2",
          "ipfs://b",
          false
        )
      ).to.emit(contract, "MessageAdded");

      const ids = await contract.getMessageIds(S1);
      expect(ids.length).to.equal(2);
      const [, , media] = await contract.getMessage(S1, M2);
      expect(media).to.equal("ipfs://b");
      expect(await contract.isSessionClosed(S1)).to.equal(false);
    });

    it("owner can append a content-only update using 4-arg (media empty)", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "v1",
        "ipfs://a"
      );

      await expect(
        contract["abrahamUpdate(string,string,string,string,bool)"](
          S1,
          M2,
          "text-only v2",
          "",
          false
        )
      ).to.emit(contract, "MessageAdded");

      const [author, content, media, pc] = await contract.getMessage(S1, M2);
      expect(author).to.equal(await contract.owner());
      expect(content).to.equal("text-only v2");
      expect(media).to.equal("");
      expect(pc).to.equal(0);
    });

    it("owner can append a content-only update using the 3-arg overload (+ bool)", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "v1",
        "ipfs://a"
      );

      await expect(
        contract["abrahamUpdate(string,string,string,bool)"](
          S1,
          M2,
          "overloaded text",
          false
        )
      ).to.emit(contract, "MessageAdded");

      const [, content, media] = await contract.getMessage(S1, M2);
      expect(content).to.equal("overloaded text");
      expect(media).to.equal("");
    });

    it("owner can close and later reopen the session", async () => {
      const { contract, user1, PRAISE_PRICE, BLESS_PRICE } = await loadFixture(
        deployFixture
      );

      /* create and then CLOSE */
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "v1",
        "ipfs://a"
      );
      await expect(
        contract["abrahamUpdate(string,string,string,string,bool)"](
          S1,
          M2,
          "closing msg",
          "ipfs://b",
          true
        )
      ).to.emit(contract, "SessionClosed");
      expect(await contract.isSessionClosed(S1)).to.equal(true);

      /* bless / praise should revert while closed */
      await expect(
        contract.connect(user1).bless(S1, B1, "hi", { value: BLESS_PRICE })
      ).to.be.revertedWith("Session closed");
      await expect(
        contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE })
      ).to.be.revertedWith("Session closed");

      /* now REOPEN using 3-arg overload (content-only is fine) */
      await expect(
        contract["abrahamUpdate(string,string,string,bool)"](
          S1,
          M3,
          "reopen msg",
          false
        )
      ).to.emit(contract, "SessionReopened");
      expect(await contract.isSessionClosed(S1)).to.equal(false);

      /* bless / praise succeed again */
      await contract
        .connect(user1)
        .bless(S1, B2, "thanks", { value: BLESS_PRICE });
      await contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE });
    });

    it("reverts when both content and media are empty (4-arg)", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "v1",
        "ipfs://a"
      );
      await expect(
        contract["abrahamUpdate(string,string,string,string,bool)"](
          S1,
          M2,
          "",
          "",
          false
        )
      ).to.be.revertedWith("Empty message");
    });
  });

  /* ---------------------- bless -------------------------- */
  describe("bless", () => {
    it("user can bless with exact fee", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "v1",
        "ipfs://a"
      );

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
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "v1",
        "ipfs://a"
      );

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
    it("user can praise multiple times; each praise costs fee", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "v1",
        "ipfs://a"
      );

      /* first praise */
      await expect(
        contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE })
      ).to.emit(contract, "Praised");
      let [, , , pc] = await contract.getMessage(S1, M1);
      expect(pc).to.equal(1);

      /* second praise by SAME user */
      await expect(
        contract.connect(user1).praise(S1, M1, { value: PRAISE_PRICE })
      ).to.emit(contract, "Praised");
      [, , , pc] = await contract.getMessage(S1, M1);
      expect(pc).to.equal(2);
    });

    it("fails with wrong fee or unknown message", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "v1",
        "ipfs://a"
      );

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
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "v1",
        "ipfs://a"
      );
      await contract["abrahamUpdate(string,string,string,string,bool)"](
        S1,
        M2,
        "v2",
        "ipfs://b",
        false
      );

      await expect(
        contract.connect(user1).batchPraise(S1, [M1, M2], {
          value: PRAISE_PRICE * 2n,
        })
      ).to.emit(contract, "Praised");

      let [, , , pc1] = await contract.getMessage(S1, M1);
      let [, , , pc2] = await contract.getMessage(S1, M2);
      expect(pc1).to.equal(1);
      expect(pc2).to.equal(1);
    });

    it("reverts on incorrect ETH or closed session", async () => {
      const { contract, user1, PRAISE_PRICE } = await loadFixture(
        deployFixture
      );
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "v1",
        "ipfs://a"
      );
      await contract["abrahamUpdate(string,string,string,string,bool)"](
        S1,
        M2,
        "v2",
        "ipfs://b",
        true
      ); // close

      await expect(
        contract.connect(user1).batchPraise(S1, [M1, M2], {
          value: PRAISE_PRICE * 2n,
        })
      ).to.be.revertedWith("Session closed");

      // reopen to test ETH mismatch
      await contract["abrahamUpdate(string,string,string,bool)"](
        S1,
        M3,
        "reopen",
        false
      );
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
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "hello",
        "ipfs://a"
      );

      await expect(
        contract.connect(user1).batchPraise(S1, [M1, "ghost"], {
          value: PRAISE_PRICE * 2n,
        })
      ).to.be.revertedWith("Message not found");

      // Verify no partial praise happened
      let [, , , pc] = await contract.getMessage(S1, M1);
      expect(pc).to.equal(0);
    });
  });

  /* ---------------------- batchBless --------------------- */
  describe("batchBless", () => {
    it("blesses multiple text messages atomically with exact total fee", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "root",
        "ipfs://a"
      );

      await expect(
        contract.connect(user1).batchBless(S1, [B1, B2], ["alpha", "beta"], {
          value: BLESS_PRICE * 2n,
        })
      ).to.emit(contract, "MessageAdded");

      const ids = await contract.getMessageIds(S1);
      expect(ids.length).to.equal(3);

      const [a1, c1, m1] = await contract.getMessage(S1, B1);
      const [a2, c2, m2] = await contract.getMessage(S1, B2);
      expect(a1).to.equal(user1.address);
      expect(a2).to.equal(user1.address);
      expect(c1).to.equal("alpha");
      expect(c2).to.equal("beta");
      expect(m1).to.equal("");
      expect(m2).to.equal("");
    });

    it("reverts on closed session, length mismatch, empty content, or duplicate id", async () => {
      const { contract, user1, BLESS_PRICE } = await loadFixture(deployFixture);
      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "root",
        "ipfs://a"
      );
      await contract["abrahamUpdate(string,string,string,string,bool)"](
        S1,
        M2,
        "close it",
        "ipfs://b",
        true
      );

      await expect(
        contract
          .connect(user1)
          .batchBless(S1, [B1], ["x"], { value: BLESS_PRICE })
      ).to.be.revertedWith("Session closed");

      // reopen
      await contract["abrahamUpdate(string,string,string,bool)"](
        S1,
        M3,
        "reopen",
        false
      );

      await expect(
        contract
          .connect(user1)
          .batchBless(S1, [B1, B2], ["x"], { value: BLESS_PRICE * 2n })
      ).to.be.revertedWith("Length mismatch");

      await expect(
        contract
          .connect(user1)
          .batchBless(S1, [B1], [""], { value: BLESS_PRICE })
      ).to.be.revertedWith("Content required");

      // create B1 once, then attempt duplicate
      await contract
        .connect(user1)
        .batchBless(S1, [B1], ["ok"], { value: BLESS_PRICE });
      await expect(
        contract
          .connect(user1)
          .batchBless(S1, [B1], ["dup"], { value: BLESS_PRICE })
      ).to.be.revertedWith("Message exists");
    });
  });

  /* ------------- abrahamBatchUpdate (single session) ------------- */
  describe("abrahamBatchUpdate", () => {
    it("owner posts multiple messages (content/media mix) and toggles closed state", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract["createSession(string,string,string)"](
        "s-batch",
        "m0",
        "seed"
      );

      await expect(
        contract.abrahamBatchUpdate(
          "s-batch",
          [
            { messageId: "m1", content: "text-only", media: "" },
            { messageId: "m2", content: "", media: "ipfs://x" },
            { messageId: "m3", content: "both", media: "ipfs://y" },
          ],
          true
        )
      ).to.emit(contract, "SessionClosed");

      const ids = await contract.getMessageIds("s-batch");
      expect(ids).to.deep.equal(["m0", "m1", "m2", "m3"]);
      expect(await contract.isSessionClosed("s-batch")).to.equal(true);

      const [, c1, m1] = await contract.getMessage("s-batch", "m1");
      const [, c2, m2] = await contract.getMessage("s-batch", "m2");
      const [, c3, m3] = await contract.getMessage("s-batch", "m3");
      expect(c1).to.equal("text-only");
      expect(m1).to.equal("");
      expect(c2).to.equal("");
      expect(m2).to.equal("ipfs://x");
      expect(c3).to.equal("both");
      expect(m3).to.equal("ipfs://y");
    });

    it("reverts on empty items, duplicate message id, or empty payload item", async () => {
      const { contract } = await loadFixture(deployFixture);
      await contract["createSession(string,string,string,string)"](
        "s2",
        "m0",
        "root",
        "ipfs://r"
      );

      await expect(
        contract.abrahamBatchUpdate("s2", [], false)
      ).to.be.revertedWith("No items");

      // create one, then try duplicate in batch
      await contract["abrahamUpdate(string,string,string,bool)"](
        "s2",
        "x1",
        "ok",
        false
      );
      await expect(
        contract.abrahamBatchUpdate(
          "s2",
          [{ messageId: "x1", content: "dup", media: "" }],
          false
        )
      ).to.be.revertedWith("Message exists");

      // empty payload item
      await expect(
        contract.abrahamBatchUpdate(
          "s2",
          [{ messageId: "x2", content: "", media: "" }],
          false
        )
      ).to.be.revertedWith("Empty message");
    });
  });

  /* ----------------- NEW: abrahamBatchCreate ---------------- */
  describe("abrahamBatchCreate (cross-session)", () => {
    it("creates multiple sessions at once (mixed content/media)", async () => {
      const { contract } = await loadFixture(deployFixture);

      await contract.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, content: "hello A", media: "" },
        {
          sessionId: SB,
          firstMessageId: MB0,
          content: "",
          media: "ipfs://imgB",
        },
      ]);

      expect(await contract.isSessionClosed(SA)).to.equal(false);
      expect(await contract.isSessionClosed(SB)).to.equal(false);

      let idsA = await contract.getMessageIds(SA);
      let idsB = await contract.getMessageIds(SB);
      expect(idsA).to.deep.equal([MA0]);
      expect(idsB).to.deep.equal([MB0]);

      const [, cA, mA] = await contract.getMessage(SA, MA0);
      const [, cB, mB] = await contract.getMessage(SB, MB0);
      expect(cA).to.equal("hello A");
      expect(mA).to.equal("");
      expect(cB).to.equal("");
      expect(mB).to.equal("ipfs://imgB");

      // sessionTotal should be 2
      const total = await contract.sessionTotal();
      expect(toBI(total)).to.equal(2n);
    });

    it("reverts for duplicate session, duplicate message, or empty payload", async () => {
      const { contract } = await loadFixture(deployFixture);

      // create one valid session first
      await contract.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, content: "ok", media: "" },
      ]);

      // duplicate sessionId
      await expect(
        contract.abrahamBatchCreate([
          { sessionId: SA, firstMessageId: "new", content: "x", media: "" },
        ])
      ).to.be.revertedWith("Session exists");

      // duplicate messageId within a NEW session (ensure unique message per session)
      await expect(
        contract.abrahamBatchCreate([
          { sessionId: SB, firstMessageId: MA0, content: "x", media: "" }, // MA0 used in SA, but message uniqueness is per-session; however our contract checks per (sessionId, messageId) so this should pass if session differs.
        ])
      ).to.not.be.reverted; // clarify behavior: messageId uniqueness is per-session

      // empty payload
      await expect(
        contract.abrahamBatchCreate([
          { sessionId: SC, firstMessageId: MC0, content: "", media: "" },
        ])
      ).to.be.revertedWith("Empty message");
    });
  });

  /* ------ NEW: abrahamBatchUpdateAcrossSessions (cross-session) ------ */
  describe("abrahamBatchUpdateAcrossSessions", () => {
    it("adds one owner message to each target session", async () => {
      const { contract } = await loadFixture(deployFixture);

      // prepare two sessions
      await contract.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, content: "seed A", media: "" },
        {
          sessionId: SB,
          firstMessageId: MB0,
          content: "",
          media: "ipfs://seedB",
        },
      ]);

      await expect(
        contract.abrahamBatchUpdateAcrossSessions([
          { sessionId: SA, messageId: MA1, content: "", media: "ipfs://A1" },
          { sessionId: SB, messageId: MB1, content: "hello B", media: "" },
        ])
      ).to.emit(contract, "MessageAdded");

      const idsA = await contract.getMessageIds(SA);
      const idsB = await contract.getMessageIds(SB);
      expect(idsA).to.deep.equal([MA0, MA1]);
      expect(idsB).to.deep.equal([MB0, MB1]);

      const [, cA1, mA1] = await contract.getMessage(SA, MA1);
      const [, cB1, mB1] = await contract.getMessage(SB, MB1);
      expect(cA1).to.equal("");
      expect(mA1).to.equal("ipfs://A1");
      expect(cB1).to.equal("hello B");
      expect(mB1).to.equal("");
    });

    it("reverts on unknown session, duplicate message id in that session, or empty payload", async () => {
      const { contract } = await loadFixture(deployFixture);

      // prepare one session
      await contract.abrahamBatchCreate([
        { sessionId: SA, firstMessageId: MA0, content: "seed", media: "" },
      ]);

      // unknown session
      await expect(
        contract.abrahamBatchUpdateAcrossSessions([
          { sessionId: "ghost", messageId: "m-x", content: "x", media: "" },
        ])
      ).to.be.revertedWith("Session not found");

      // duplicate message id in SA
      await expect(
        contract.abrahamBatchUpdateAcrossSessions([
          { sessionId: SA, messageId: MA0, content: "dup", media: "" },
        ])
      ).to.be.revertedWith("Message exists");

      // empty payload
      await expect(
        contract.abrahamBatchUpdateAcrossSessions([
          { sessionId: SA, messageId: "new", content: "", media: "" },
        ])
      ).to.be.revertedWith("Empty message");
    });
  });

  /* --------------------- withdraw ------------------------ */
  describe("withdraw", () => {
    it("transfers all ETH to owner", async () => {
      const { contract, abraham, user1, PRAISE_PRICE, BLESS_PRICE } =
        await loadFixture(deployFixture);

      await contract["createSession(string,string,string,string)"](
        S1,
        M1,
        "art",
        "ipfs://media"
      );
      await contract.connect(user1).bless(S1, B1, "hi", { value: BLESS_PRICE });
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
