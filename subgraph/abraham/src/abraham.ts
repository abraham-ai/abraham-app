import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  MessageAdded as MessageAddedEvent,
  Praised as PraisedEvent,
  SessionCreated as SessionCreatedEvent,
} from "../generated/Abraham/Abraham";

import {
  MessageAdded,
  Praised,
  SessionCreated,
  Creation,
  AbrahamMessage,
  Blessing,
  Praise,
} from "../generated/schema";

/*-----------------------------------------------------------
  Owner address (replace with real contract owner)
-----------------------------------------------------------*/
const FATHER_ABRAHAM = Address.fromString(
  "0x641f5ffC5F6239A0873Bd00F9975091FB035aAFC"
);

/*-----------------------------------------------------------
  Helpers
-----------------------------------------------------------*/
function loadOrCreateCreation(id: string): Creation {
  let c = Creation.load(id);
  if (c == null) {
    c = new Creation(id);
    c.abrahamMessageCount = 0;
    c.blessingCount = 0;
    c.ethSpentPraise = BigInt.zero();
    c.ethSpentBless = BigInt.zero();
    c.ethSpentTotal = BigInt.zero();
  }
  return c as Creation;
}

/*-----------------------------------------------------------
  SessionCreated
-----------------------------------------------------------*/
export function handleSessionCreated(e: SessionCreatedEvent): void {
  // raw mirror
  let m = new SessionCreated(e.transaction.hash.concatI32(e.logIndex.toI32()));
  m.sessionId = e.params.sessionId;
  m.blockNumber = e.block.number;
  m.blockTimestamp = e.block.timestamp;
  m.transactionHash = e.transaction.hash;
  m.save();

  // domain
  loadOrCreateCreation(e.params.sessionId.toString()).save();
}

/*-----------------------------------------------------------
  MessageAdded
-----------------------------------------------------------*/
export function handleMessageAdded(e: MessageAddedEvent): void {
  // raw mirror
  let raw = new MessageAdded(e.transaction.hash.concatI32(e.logIndex.toI32()));
  raw.sessionId = e.params.sessionId;
  raw.messageIndex = e.params.messageIndex;
  raw.author = e.params.author;
  raw.content = e.params.content;
  raw.media = e.params.media;
  raw.blockNumber = e.block.number;
  raw.blockTimestamp = e.block.timestamp;
  raw.transactionHash = e.transaction.hash;
  raw.save();

  // domain
  const sid = e.params.sessionId.toString();
  const idx = e.params.messageIndex.toI32();
  const uid = sid + "-" + idx.toString();
  const fee = e.transaction.value; // wei sent with this tx

  let creation = loadOrCreateCreation(sid);

  if (e.params.author.equals(FATHER_ABRAHAM)) {
    let am = new AbrahamMessage(uid);
    am.creation = sid;
    am.index = idx;
    am.content = e.params.content;
    am.media = e.params.media;
    am.praiseCount = 0;
    am.save();

    creation.abrahamMessageCount = idx + 1;
  } else {
    let bl = new Blessing(uid);
    bl.creation = sid;
    bl.index = idx;
    bl.author = e.params.author;
    bl.content = e.params.content;
    bl.praiseCount = 0;
    bl.save();

    creation.blessingCount += 1;
    creation.ethSpentBless = creation.ethSpentBless.plus(fee);
    creation.ethSpentTotal = creation.ethSpentTotal.plus(fee);
  }

  creation.save();
}

/*-----------------------------------------------------------
  Praised
-----------------------------------------------------------*/
export function handlePraised(e: PraisedEvent): void {
  // raw mirror
  let raw = new Praised(e.transaction.hash.concatI32(e.logIndex.toI32()));
  raw.sessionId = e.params.sessionId;
  raw.messageIndex = e.params.messageIndex;
  raw.praiser = e.params.praiser;
  raw.blockNumber = e.block.number;
  raw.blockTimestamp = e.block.timestamp;
  raw.transactionHash = e.transaction.hash;
  raw.save();

  // domain
  const sid = e.params.sessionId.toString();
  const idx = e.params.messageIndex.toI32();
  const uid = sid + "-" + idx.toString();
  const pid = uid + "-" + e.params.praiser.toHexString();
  const fee = e.transaction.value;

  let creation = loadOrCreateCreation(sid);

  let p = new Praise(pid);
  p.praiser = e.params.praiser;
  p.timestamp = e.block.timestamp;

  let bl = Blessing.load(uid);
  if (bl) {
    p.blessing = uid;
    bl.praiseCount += 1;
    bl.save();
  } else {
    let am = AbrahamMessage.load(uid);
    if (am == null) return;
    p.abrahamMessage = uid;
    am.praiseCount += 1;
    am.save();
  }

  creation.ethSpentPraise = creation.ethSpentPraise.plus(fee);
  creation.ethSpentTotal = creation.ethSpentTotal.plus(fee);
  creation.save();

  p.save();
}
