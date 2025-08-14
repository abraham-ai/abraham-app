// src/abraham.ts
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
 * NOTE on prices:
 * Keep these in sync with the contract constants:
 * PRAISE_PRICE = 10_000_000_000_000 wei
 * BLESS_PRICE  = 20_000_000_000_000 wei
 */
const PRAISE_PRICE = BigInt.fromI64(10_000_000_000_000); // 0.00001 ETH
const BLESS_PRICE = BigInt.fromI64(20_000_000_000_000); // 0.00002 ETH

/**
 * Abraham (owner) address used only for ETH bookkeeping:
 * If MessageAdded.author != ABRAHAM, we treat it as a user "blessing"
 * and add BLESS_PRICE to Creation.ethSpent. Owner posts are free.
 */
const ABRAHAM = Address.fromString(
  "0x641f5ffC5F6239A0873Bd00F9975091FB035aAFC"
);

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Event Handlers                                                     */
/* ------------------------------------------------------------------ */

export function handleSessionCreated(e: SessionCreated): void {
  // Create brand-new Creation. (If out-of-order, it may already exist—overwrite safe fields.)
  let c = Creation.load(e.params.sessionId);
  if (c == null) {
    c = new Creation(e.params.sessionId);
    c.messageCount = 0;
    c.firstMessageAt = e.block.timestamp;
    c.ethSpent = BigInt.zero();
  }
  c.lastActivityAt = e.block.timestamp;
  c.closed = false;
  c.save();
}

export function handleSessionClosed(e: SessionClosed): void {
  let c = Creation.load(e.params.sessionId);
  if (c == null) {
    // Defensive bootstrap in case of out-of-order events relative to startBlock
    c = new Creation(e.params.sessionId);
    c.messageCount = 0;
    c.firstMessageAt = e.block.timestamp;
    c.ethSpent = BigInt.zero();
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
    creation.closed = false;
  }

  // Create Message
  const m = new Message(msgEntityId);
  m.creation = sessionId;
  m.uuid = perSessionMsgId;
  m.author = e.params.author;
  m.content = e.params.content; // may be ""
  m.media = e.params.media.length > 0 ? e.params.media : null;
  m.timestamp = e.block.timestamp;
  m.praiseCount = 0;
  m.save();

  // Ensure author in Users
  getOrCreateUser(e.params.author);

  // Update Creation counters/last activity
  creation.messageCount = creation.messageCount + 1;
  creation.lastActivityAt = e.block.timestamp;

  // Blessings (user-authored messages) increase ethSpent
  if (!e.params.author.equals(ABRAHAM)) {
    creation.ethSpent = creation.ethSpent.plus(BLESS_PRICE);
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
  if (msg == null) {
    // If message not found (out-of-order), we cannot properly attach; bail out defensively.
    return;
  }

  // Create immutable Praise
  const p = new Praise(praiseEntityId);
  p.message = msgEntityId;
  p.praiser = e.params.praiser;
  p.timestamp = e.block.timestamp;
  p.save();

  // Increment message praise count
  msg.praiseCount = msg.praiseCount + 1;
  msg.save();

  // Update Creation bookkeeping
  let creation = Creation.load(sessionId);
  if (creation != null) {
    creation.ethSpent = creation.ethSpent.plus(PRAISE_PRICE);
    creation.lastActivityAt = e.block.timestamp;
    creation.save();
  }

  // User counters
  let giver = getOrCreateUser(e.params.praiser);
  giver.praisesGiven = giver.praisesGiven + 1;
  giver.save();

  let authorU = getOrCreateUser(Address.fromBytes(msg.author));
  authorU.praisesReceived = authorU.praisesReceived + 1;
  authorU.save();
}
