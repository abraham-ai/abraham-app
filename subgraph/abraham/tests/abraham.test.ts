import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Address } from "@graphprotocol/graph-ts"
import { MessageAdded } from "../generated/schema"
import { MessageAdded as MessageAddedEvent } from "../generated/Abraham/Abraham"
import { handleMessageAdded } from "../src/abraham"
import { createMessageAddedEvent } from "./abraham-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let sessionId = BigInt.fromI32(234)
    let messageIndex = BigInt.fromI32(234)
    let author = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let content = "Example string value"
    let media = "Example string value"
    let newMessageAddedEvent = createMessageAddedEvent(
      sessionId,
      messageIndex,
      author,
      content,
      media
    )
    handleMessageAdded(newMessageAddedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("MessageAdded created and stored", () => {
    assert.entityCount("MessageAdded", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "MessageAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "sessionId",
      "234"
    )
    assert.fieldEquals(
      "MessageAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "messageIndex",
      "234"
    )
    assert.fieldEquals(
      "MessageAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "author",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "MessageAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "content",
      "Example string value"
    )
    assert.fieldEquals(
      "MessageAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "media",
      "Example string value"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
