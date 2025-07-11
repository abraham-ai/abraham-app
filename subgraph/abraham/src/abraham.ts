import {
  MessageAdded as MessageAddedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  Praised as PraisedEvent,
  SessionCreated as SessionCreatedEvent
} from "../generated/Abraham/Abraham"
import {
  MessageAdded,
  OwnershipTransferred,
  Praised,
  SessionCreated
} from "../generated/schema"

export function handleMessageAdded(event: MessageAddedEvent): void {
  let entity = new MessageAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.sessionId = event.params.sessionId
  entity.messageIndex = event.params.messageIndex
  entity.author = event.params.author
  entity.content = event.params.content
  entity.media = event.params.media

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePraised(event: PraisedEvent): void {
  let entity = new Praised(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.sessionId = event.params.sessionId
  entity.messageIndex = event.params.messageIndex
  entity.praiser = event.params.praiser

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleSessionCreated(event: SessionCreatedEvent): void {
  let entity = new SessionCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.sessionId = event.params.sessionId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
