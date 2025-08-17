import {
  SessionCreated,
  SessionClosed,
  SessionReopened,
  MessageAdded,
  Praised,
} from "../generated/Abraham/Abraham";
import { Creation, Message, Praise, User } from "../generated/schema";
import { Address, BigInt } from "@graphprotocol/graph-ts";

/**
 * Keep these in sync with contract constants:
 * PRAISE_PRICE = 10_000_000_000_000 wei
 * BLESS_PRICE  = 20_000_000_000_000 wei
 */
const PRAISE_PRICE = BigInt.fromI64(10_000_000_000_000);
const BLESS_PRICE = BigInt.fromI64(20_000_000_000_000);

/**
 * Abraham (owner) address used for ETH bookkeeping.
 * If MessageAdded.author != ABRAHAM, treat as user "blessing" and add BLESS_PRICE to Creation.ethSpent.
 * ⚠️ Update this to the actual owner address you deploy with.
 */
const ABRAHAM = Address.fromString(
  "0x641f5ffC5F6239A0873Bd00F9975091FB035aAFC"
);

/* Helpers */
function getOrCreateUser(addr: Address): User {
  let id = addr.toHexString();
  let u = User.load(id);
  if (u == null) {
    u = new User(id);
    u.praisesGiven = 0;
    u.praisesReceived = 0;
    u.save();
  }
  return u as User;
}

/* Event Handlers */
export function handleSessionCreated(e: SessionCreated): void {
  let c = Creation.load(e.params.sessionId);
  if (c == null) {
    c = new Creation(e.params.sessionId);
    c.messageCount = 0;
    c.firstMessageAt = e.block.timestamp;
    c.ethSpent = BigInt.zero();
    c.totalBlessings = 0;
    c.totalPraises = 0;
  }
  c.lastActivityAt = e.block.timestamp;
  c.closed = false; // always open at creation
  c.save();
}

export function handleSessionClosed(e: SessionClosed): void {
  let c = Creation.load(e.params.sessionId);
  if (c == null) {
    c = new Creation(e.params.sessionId);
    c.messageCount = 0;
    c.firstMessageAt = e.block.timestamp;
    c.ethSpent = BigInt.zero();
    c.totalBlessings = 0;
    c.totalPraises = 0;
  }
  c.closed = true;
  c.lastActivityAt = e.block.timestamp;
  c.save();
}

export function handleSessionReopened(e: SessionReopened): void {
  let c = Creation.load(e.params.sessionId);
  if (c == null) {
    c = new Creation(e.params.sessionId);
    c.messageCount = 0;
    c.firstMessageAt = e.block.timestamp;
    c.ethSpent = BigInt.zero();
    c.totalBlessings = 0;
    c.totalPraises = 0;
  }
  c.closed = false;
  c.lastActivityAt = e.block.timestamp;
  c.save();
}

export function handleMessageAdded(e: MessageAdded): void {
  const sessionId = e.params.sessionId;
  const perSessionMsgId = e.params.messageId;
  const msgEntityId = sessionId.concat("-").concat(perSessionMsgId);

  // Bootstrap Creation if events arrive out-of-order
  let creation = Creation.load(sessionId);
  if (creation == null) {
    creation = new Creation(sessionId);
    creation.messageCount = 0;
    creation.firstMessageAt = e.block.timestamp;
    creation.ethSpent = BigInt.zero();
    creation.totalBlessings = 0;
    creation.totalPraises = 0;
    creation.closed = false;
  }

  // Create Message (no on-chain content/media; we only store CID)
  const m = new Message(msgEntityId);
  m.creation = sessionId;
  m.uuid = perSessionMsgId;
  m.author = e.params.author;
  m.cid = e.params.cid; // IPFS JSON CID
  m.timestamp = e.block.timestamp;
  m.praiseCount = 0; // will be incremented by Praised events
  m.save();

  // Ensure author in Users
  getOrCreateUser(e.params.author);

  // Update Creation counters/last activity
  creation.messageCount = creation.messageCount + 1;
  creation.lastActivityAt = e.block.timestamp;

  // Blessings (user-authored messages) increase ethSpent and totalBlessings
  if (!e.params.author.equals(ABRAHAM)) {
    creation.ethSpent = creation.ethSpent.plus(BLESS_PRICE);
    creation.totalBlessings = creation.totalBlessings + 1;
  }

  creation.save();
}

export function handlePraised(e: Praised): void {
  const sessionId = e.params.sessionId;
  const perSessionMsgId = e.params.messageId;
  const msgEntityId = sessionId.concat("-").concat(perSessionMsgId);
  const praiseEntityId = msgEntityId
    .concat("-")
    .concat(e.transaction.hash.toHexString())
    .concat("-")
    .concat(e.logIndex.toString());

  let msg = Message.load(msgEntityId);
  if (msg == null) return;

  const p = new Praise(praiseEntityId);
  p.message = msgEntityId;
  p.praiser = e.params.praiser;
  p.timestamp = e.block.timestamp;
  p.save();

  msg.praiseCount = msg.praiseCount + 1;
  msg.save();

  let creation = Creation.load(sessionId);
  if (creation != null) {
    // PRAISE costs are borne by users, add to ethSpent
    creation.ethSpent = creation.ethSpent.plus(PRAISE_PRICE);
    creation.totalPraises = creation.totalPraises + 1;
    creation.lastActivityAt = e.block.timestamp;
    creation.save();
  }

  let giver = getOrCreateUser(e.params.praiser);
  giver.praisesGiven = giver.praisesGiven + 1;
  giver.save();

  let authorU = getOrCreateUser(Address.fromBytes(msg.author));
  authorU.praisesReceived = authorU.praisesReceived + 1;
  authorU.save();
}
