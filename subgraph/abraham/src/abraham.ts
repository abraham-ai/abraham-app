import {
  SessionCreated,
  MessageAdded,
  Praised,
} from "../generated/Abraham/Abraham";
import { Creation, Message, Praise } from "../generated/schema";
import { Address, BigInt } from "@graphprotocol/graph-ts";

/* Contract constants (wei) */
const BLESS_PRICE = BigInt.fromI64(20_000_000_000_000); // 0.00002 ETH
const PRAISE_PRICE = BigInt.fromI64(10_000_000_000_000); // 0.00001 ETH

/* Owner address */
const ABRAHAM = Address.fromString(
  "0x641f5ffC5F6239A0873Bd00F9975091FB035aAFC"
);

/*──────────────  Creation  ─────────────*/
export function handleSessionCreated(e: SessionCreated): void {
  const id = e.params.sessionId.toString();

  const c = new Creation(id);
  c.messageCount = 0;
  c.createdAt = e.block.timestamp;
  c.updatedAt = e.block.timestamp;
  c.ethSpent = BigInt.zero();
  c.save();
}

/*──────────────  Message  ─────────────*/
export function handleMessageAdded(e: MessageAdded): void {
  const creationId = e.params.sessionId.toString();
  const idx = e.params.messageIndex.toI32();
  const msgId = `${creationId}-${idx}`;

  /* Load or bootstrap Creation */
  let creation = Creation.load(creationId);
  if (creation == null) {
    creation = new Creation(creationId);
    creation.messageCount = 0;
    creation.createdAt = e.block.timestamp;
    creation.ethSpent = BigInt.zero();
  }

  /* Build Message */
  const m = new Message(msgId);
  m.creation = creationId;
  m.index = idx;
  m.author = e.params.author;
  m.content = e.params.content;
  m.media = e.params.media.length ? e.params.media : null;
  m.timestamp = e.block.timestamp;
  m.praiseCount = 0;
  m.save();

  /* Counters & spending */
  creation.messageCount = idx + 1;

  const isBlessing = !e.params.author.equals(ABRAHAM);
  if (isBlessing) {
    creation.ethSpent = creation.ethSpent.plus(BLESS_PRICE);
  }

  creation.updatedAt = e.block.timestamp;
  creation.save();
}

/*──────────────  Praise  ─────────────*/
export function handlePraised(e: Praised): void {
  const creationId = e.params.sessionId.toString();
  const idx = e.params.messageIndex.toI32();
  const msgId = `${creationId}-${idx}`;
  const praiseId = `${msgId}-${e.params.praiser.toHexString()}`;

  let msg = Message.load(msgId);
  if (msg == null) return; // safety

  /* Create Praise */
  const p = new Praise(praiseId);
  p.message = msgId;
  p.praiser = e.params.praiser;
  p.timestamp = e.block.timestamp;
  p.save();

  /* Update message counter */
  msg.praiseCount += 1;
  msg.save();

  /* Update creation totals */
  let creation = Creation.load(creationId)!;
  creation.ethSpent = creation.ethSpent.plus(PRAISE_PRICE);
  creation.updatedAt = e.block.timestamp;
  creation.save();
}
