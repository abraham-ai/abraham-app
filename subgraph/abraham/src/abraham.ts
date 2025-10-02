// src/abraham.ts
import {
  SessionCreated,
  SessionClosed,
  SessionReopened,
  MessageAdded,
  Praised,
  LinkedStake,
} from "../generated/Abraham/Abraham";
import {
  Creation,
  Message,
  Praise,
  Curator,
  CuratorLink,
} from "../generated/schema";
import { Address, BigInt, Bytes, crypto } from "@graphprotocol/graph-ts";

/* ───────── helpers ───────── */

function creationHashFromString(sessionId: string): string {
  // keccak256(sessionId) -> 0x...
  return crypto.keccak256(Bytes.fromUTF8(sessionId)).toHexString();
}

function creationHashFromIndexedTopic(topic: Bytes): string {
  // Already keccak(sessionId) as Bytes -> to hex string
  return topic.toHexString();
}

function getOrCreateCreationByHash(idHash: string, ts: BigInt): Creation {
  let c = Creation.load(idHash);
  if (c == null) {
    c = new Creation(idHash);
    c.messageCount = 0;
    c.firstMessageAt = ts;
    c.lastActivityAt = ts;
    c.closed = false;
    c.totalBlessings = 0;
    c.totalPraises = 0;
    c.linkedTotal = BigInt.zero();
  }
  return c as Creation;
}

function getOrCreateCurator(addr: Address): Curator {
  let id = addr.toHexString();
  let u = Curator.load(id);
  if (u == null) {
    u = new Curator(id);
    u.totalLinked = BigInt.zero();
    u.praisesGiven = 0;
    u.praisesReceived = 0;
  }
  return u as Curator;
}

function linkId(creationHash: string, user: Address): string {
  return creationHash.concat("-").concat(user.toHexString());
}

/* ───────── sessions (string param -> compute hash, also store raw string) ───────── */

export function handleSessionCreated(e: SessionCreated): void {
  const raw = e.params.sessionId;
  const hash = creationHashFromString(raw);

  let c = getOrCreateCreationByHash(hash, e.block.timestamp);
  c.sessionIdRaw = raw;
  c.closed = false;
  c.lastActivityAt = e.block.timestamp;
  c.save();
}

export function handleSessionClosed(e: SessionClosed): void {
  const raw = e.params.sessionId;
  const hash = creationHashFromString(raw);

  let c = getOrCreateCreationByHash(hash, e.block.timestamp);
  c.sessionIdRaw = raw;
  c.closed = true;
  c.lastActivityAt = e.block.timestamp;
  c.save();
}

export function handleSessionReopened(e: SessionReopened): void {
  const raw = e.params.sessionId;
  const hash = creationHashFromString(raw);

  let c = getOrCreateCreationByHash(hash, e.block.timestamp);
  c.sessionIdRaw = raw;
  c.closed = false;
  c.lastActivityAt = e.block.timestamp;
  c.save();
}

/* ───────── messages (string param -> compute same hash) ───────── */

export function handleMessageAdded(e: MessageAdded): void {
  const raw = e.params.sessionId;
  const hash = creationHashFromString(raw);
  const msgEntityId = hash.concat("-").concat(e.params.messageId);

  let creation = getOrCreateCreationByHash(hash, e.block.timestamp);
  creation.sessionIdRaw = raw;

  const m = new Message(msgEntityId);
  m.creation = hash;
  m.uuid = e.params.messageId;
  m.author = e.params.author;
  m.cid = e.params.cid;
  m.timestamp = e.block.timestamp;
  m.praiseCount = 0;
  m.save();

  creation.messageCount = creation.messageCount + 1;
  creation.lastActivityAt = e.block.timestamp;
  creation.save();
}

/* ───────── praises (string param -> compute same hash) ───────── */

export function handlePraised(e: Praised): void {
  const raw = e.params.sessionId;
  const hash = creationHashFromString(raw);
  const msgEntityId = hash.concat("-").concat(e.params.messageId);
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

  let creation = getOrCreateCreationByHash(hash, e.block.timestamp);
  creation.sessionIdRaw = raw;
  creation.totalPraises = creation.totalPraises + 1;
  creation.lastActivityAt = e.block.timestamp;
  creation.save();

  let giver = getOrCreateCurator(e.params.praiser);
  giver.praisesGiven = giver.praisesGiven + 1;
  giver.save();

  let authorAddr = Address.fromBytes(msg.author);
  let rec = getOrCreateCurator(authorAddr);
  rec.praisesReceived = rec.praisesReceived + 1;
  rec.save();
}

/* ───────── linked stake (indexed string -> Bytes topic -> use hash hex directly) ─────────
   Accrual logic:
   pointsAccrued += linkedAmount * (now - lastUpdate)
   then update: lastUpdate = now; linkedAmount += delta
*/
export function handleLinkedStake(e: LinkedStake): void {
  const hash = creationHashFromIndexedTopic(e.params.sessionId); // hex string id
  const user = e.params.user;

  // Creation aggregate (trust contract's sessionLinkedTotal)
  let creation = getOrCreateCreationByHash(hash, e.block.timestamp);
  creation.linkedTotal = e.params.sessionLinkedTotal;
  creation.lastActivityAt = e.block.timestamp;
  creation.save();

  // Curator aggregate
  let curator = getOrCreateCurator(user);
  curator.totalLinked = curator.totalLinked.plus(e.params.delta);
  curator.save();

  // Per-creation link + accrual
  let id = linkId(hash, user);
  let cl = CuratorLink.load(id);
  if (cl == null) {
    cl = new CuratorLink(id);
    cl.creation = hash;
    cl.curator = curator.id;
    cl.linkedAmount = BigInt.zero();
    cl.pointsAccrued = BigInt.zero();
    cl.lastUpdate = BigInt.zero();
  }

  // Accrue time-weighted points before changing link
  if (cl.lastUpdate.gt(BigInt.zero()) && cl.linkedAmount.gt(BigInt.zero())) {
    const dt = e.block.timestamp.minus(cl.lastUpdate);
    // points += linkedAmount * dt
    cl.pointsAccrued = cl.pointsAccrued.plus(cl.linkedAmount.times(dt));
  }

  // Update timestamp then link amount (+delta)
  cl.lastUpdate = e.block.timestamp;
  cl.linkedAmount = cl.linkedAmount.plus(e.params.delta);

  cl.save();
}
