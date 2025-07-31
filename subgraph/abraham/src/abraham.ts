import {
  SessionCreated,
  SessionClosed,
  SessionReopened,
  MessageAdded,
  Praised,
} from "../generated/Abraham/Abraham";
import { Creation, Message, Praise, User } from "../generated/schema";
import { Address, BigInt } from "@graphprotocol/graph-ts";

/* Wei constants */
const PRAISE_PRICE = BigInt.fromI64(10_000_000_000_000);
const BLESS_PRICE = BigInt.fromI64(20_000_000_000_000);

/* Owner address (for ETH-spent bookkeeping) */
const ABRAHAM = Address.fromString(
  "0x641f5ffC5F6239A0873Bd00F9975091FB035aAFC"
);

/* ─────────────────────── helpers ──────────────────────── */
function getOrCreateUser(addr: Address): User {
  let u = User.load(addr.toHexString());
  if (u == null) {
    u = new User(addr.toHexString());
    u.praisesGiven = 0;
    u.praisesReceived = 0;
    u.save();
  }
  return u as User;
}

/* ────────────────── SessionCreated ────────────────────── */
export function handleSessionCreated(e: SessionCreated): void {
  const c = new Creation(e.params.sessionId);
  c.messageCount = 0;
  c.firstMessageAt = e.block.timestamp;
  c.lastActivityAt = e.block.timestamp;
  c.ethSpent = BigInt.zero();
  c.closed = false;
  c.save();
}

/* ────────────── SessionClosed / Reopened ─────────────── */
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

/* ─────────────────── MessageAdded ─────────────────────── */
export function handleMessageAdded(e: MessageAdded): void {
  const creationId = e.params.sessionId;
  const msgId = `${creationId}-${e.params.messageId}`;

  /* bootstrap Creation if events arrive out of order */
  let creation = Creation.load(creationId);
  if (creation == null) {
    creation = new Creation(creationId);
    creation.messageCount = 0;
    creation.firstMessageAt = e.block.timestamp;
    creation.ethSpent = BigInt.zero();
    creation.closed = false;
  }

  /* message entity */
  const m = new Message(msgId);
  m.creation = creationId;
  m.uuid = e.params.messageId;
  m.author = e.params.author;
  m.content = e.params.content;
  m.media = e.params.media.length ? e.params.media : null;
  m.timestamp = e.block.timestamp;
  m.praiseCount = 0;
  m.save();

  getOrCreateUser(e.params.author);

  creation.messageCount += 1;
  creation.lastActivityAt = e.block.timestamp;

  /* blessings cost ETH (if author ≠ Abraham) */
  if (!e.params.author.equals(ABRAHAM)) {
    creation.ethSpent = creation.ethSpent.plus(BLESS_PRICE);
  }
  creation.save();
}

/* ─────────────────────── Praised ──────────────────────── */
export function handlePraised(e: Praised): void {
  const creationId = e.params.sessionId;
  const msgEntityId = `${creationId}-${e.params.messageId}`;
  const praiseEntityId = `${msgEntityId}-${e.transaction.hash.toHexString()}-${e.logIndex.toString()}`;

  let msg = Message.load(msgEntityId);
  if (msg == null) return; // defensive

  /* praise entity (immutable) */
  const p = new Praise(praiseEntityId);
  p.message = msgEntityId;
  p.praiser = e.params.praiser;
  p.timestamp = e.block.timestamp;
  p.save();

  /* counters */
  msg.praiseCount += 1;
  msg.save();

  let creation = Creation.load(creationId)!;
  creation.ethSpent = creation.ethSpent.plus(PRAISE_PRICE);
  creation.lastActivityAt = e.block.timestamp;
  creation.save();

  let giver = getOrCreateUser(e.params.praiser);
  giver.praisesGiven += 1;
  giver.save();

  let authorU = getOrCreateUser(Address.fromBytes(msg.author));
  authorU.praisesReceived += 1;
  authorU.save();
}
