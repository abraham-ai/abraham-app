import {
  SessionCreated,
  SessionClosed,
  SessionReopened,
  MessageAdded,
  Praised,
} from "../generated/Abraham/Abraham";
import { Creation, Message, Praise, User } from "../generated/schema";
import { Address, BigInt } from "@graphprotocol/graph-ts";

const PRAISE_PRICE = BigInt.fromI64(10_000_000_000_000); // 0.00001 ETH in wei
const BLESS_PRICE = BigInt.fromI64(20_000_000_000_000); // 0.00002 ETH in wei

/**
 * Abraham (owner) address used only for ETH bookkeeping:
 * - When a MessageAdded author != ABRAHAM, we treat it as a paid "blessing"
 *   and add BLESS_PRICE to Creation.ethSpent.
 * - Owner posts are free and thus do not change ethSpent.
 */
const ABRAHAM = Address.fromString(
  "0x641f5ffC5F6239A0873Bd00F9975091FB035aAFC"
);

/* ------------------------------------------------------------------ */
/*                              Helpers                                */
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
/*                          Event Handlers                             */
/* ------------------------------------------------------------------ */

export function handleSessionCreated(e: SessionCreated): void {
  // Create a brand new Creation. Safe even if multiple creations occur in batch,
  // because each emits its own SessionCreated with unique sessionId.
  const c = new Creation(e.params.sessionId);
  c.messageCount = 0;
  c.firstMessageAt = e.block.timestamp;
  c.lastActivityAt = e.block.timestamp;
  c.ethSpent = BigInt.zero();
  c.closed = false;
  c.save();
}

export function handleSessionClosed(e: SessionClosed): void {
  let c = Creation.load(e.params.sessionId);
  if (c == null) return;
  c.closed = true;
  c.lastActivityAt = e.block.timestamp;
  c.save();
}

export function handleSessionReopened(e: SessionReopened): void {
  let c = Creation.load(e.params.sessionId);
  if (c == null) return;
  c.closed = false;
  c.lastActivityAt = e.block.timestamp;
  c.save();
}

export function handleMessageAdded(e: MessageAdded): void {
  const sessionId = e.params.sessionId;
  const perSessionMsgId = e.params.messageId;
  const msgEntityId = `${sessionId}-${perSessionMsgId}`;

  // Bootstrap Creation if events arrive out-of-order (e.g., subgraph startBlock)
  let creation = Creation.load(sessionId);
  if (creation == null) {
    creation = new Creation(sessionId);
    creation.messageCount = 0;
    creation.firstMessageAt = e.block.timestamp;
    creation.lastActivityAt = e.block.timestamp;
    creation.ethSpent = BigInt.zero();
    creation.closed = false;
  }

  // Message entity
  const m = new Message(msgEntityId);
  m.creation = sessionId;
  m.uuid = perSessionMsgId;
  m.author = e.params.author;
  m.content = e.params.content; // may be ""
  m.media = e.params.media.length ? e.params.media : null; // null => no media
  m.timestamp = e.block.timestamp;
  m.praiseCount = 0;
  m.save();

  // Ensure author exists as User
  getOrCreateUser(e.params.author);

  // Update creation counters
  creation.messageCount = creation.messageCount + 1;
  creation.lastActivityAt = e.block.timestamp;

  // If the author is NOT Abraham, it was a user blessing and cost BLESS_PRICE
  if (!e.params.author.equals(ABRAHAM)) {
    creation.ethSpent = creation.ethSpent.plus(BLESS_PRICE);
  }

  creation.save();
}

export function handlePraised(e: Praised): void {
  const sessionId = e.params.sessionId;
  const perSessionMsgId = e.params.messageId;
  const msgEntityId = `${sessionId}-${perSessionMsgId}`;
  const praiseEntityId = `${sessionId}-${perSessionMsgId}-${e.transaction.hash.toHexString()}-${e.logIndex.toString()}`;

  let msg = Message.load(msgEntityId);
  if (msg == null) return; // defensive guard

  // Immutable praise entity
  const p = new Praise(praiseEntityId);
  p.message = msgEntityId;
  p.praiser = e.params.praiser;
  p.timestamp = e.block.timestamp;
  p.save();

  // increment praise count on message
  msg.praiseCount = msg.praiseCount + 1;
  msg.save();

  // reflect ETH spent and last activity on the creation
  let creation = Creation.load(sessionId);
  if (creation != null) {
    creation.ethSpent = creation.ethSpent.plus(PRAISE_PRICE);
    creation.lastActivityAt = e.block.timestamp;
    creation.save();
  }

  // user counters
  let giver = getOrCreateUser(e.params.praiser);
  giver.praisesGiven = giver.praisesGiven + 1;
  giver.save();

  let authorU = getOrCreateUser(Address.fromBytes(msg.author));
  authorU.praisesReceived = authorU.praisesReceived + 1;
  authorU.save();
}
