import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  MessageAdded,
  OwnershipTransferred,
  Praised,
  SessionCreated
} from "../generated/Abraham/Abraham"

export function createMessageAddedEvent(
  sessionId: BigInt,
  messageIndex: BigInt,
  author: Address,
  content: string,
  media: string
): MessageAdded {
  let messageAddedEvent = changetype<MessageAdded>(newMockEvent())

  messageAddedEvent.parameters = new Array()

  messageAddedEvent.parameters.push(
    new ethereum.EventParam(
      "sessionId",
      ethereum.Value.fromUnsignedBigInt(sessionId)
    )
  )
  messageAddedEvent.parameters.push(
    new ethereum.EventParam(
      "messageIndex",
      ethereum.Value.fromUnsignedBigInt(messageIndex)
    )
  )
  messageAddedEvent.parameters.push(
    new ethereum.EventParam("author", ethereum.Value.fromAddress(author))
  )
  messageAddedEvent.parameters.push(
    new ethereum.EventParam("content", ethereum.Value.fromString(content))
  )
  messageAddedEvent.parameters.push(
    new ethereum.EventParam("media", ethereum.Value.fromString(media))
  )

  return messageAddedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createPraisedEvent(
  sessionId: BigInt,
  messageIndex: BigInt,
  praiser: Address
): Praised {
  let praisedEvent = changetype<Praised>(newMockEvent())

  praisedEvent.parameters = new Array()

  praisedEvent.parameters.push(
    new ethereum.EventParam(
      "sessionId",
      ethereum.Value.fromUnsignedBigInt(sessionId)
    )
  )
  praisedEvent.parameters.push(
    new ethereum.EventParam(
      "messageIndex",
      ethereum.Value.fromUnsignedBigInt(messageIndex)
    )
  )
  praisedEvent.parameters.push(
    new ethereum.EventParam("praiser", ethereum.Value.fromAddress(praiser))
  )

  return praisedEvent
}

export function createSessionCreatedEvent(sessionId: BigInt): SessionCreated {
  let sessionCreatedEvent = changetype<SessionCreated>(newMockEvent())

  sessionCreatedEvent.parameters = new Array()

  sessionCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "sessionId",
      ethereum.Value.fromUnsignedBigInt(sessionId)
    )
  )

  return sessionCreatedEvent
}
