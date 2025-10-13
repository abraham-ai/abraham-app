export const AbrahamAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "stakingPool_",
        type: "address",
      },
      {
        internalType: "address",
        name: "abrahamToken_",
        type: "address",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    inputs: [],
    name: "ReentrancyGuardReentrantCall",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousToken",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newToken",
        type: "address",
      },
    ],
    name: "AbrahamTokenUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "messageId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "address",
        name: "blesser",
        type: "address",
      },
    ],
    name: "Blessed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "user",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "delta",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "userSessionLinked",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "sessionLinkedTotal",
        type: "uint256",
      },
    ],
    name: "LinkedStake",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "messageId",
        type: "string",
      },
      {
        indexed: false,
        internalType: "address",
        name: "author",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "cid",
        type: "string",
      },
    ],
    name: "MessageAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
    ],
    name: "SessionClosed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
    ],
    name: "SessionCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
    ],
    name: "SessionReopened",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousPool",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newPool",
        type: "address",
      },
    ],
    name: "StakingPoolUpdated",
    type: "event",
  },
  {
    stateMutability: "payable",
    type: "fallback",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "string",
            name: "sessionId",
            type: "string",
          },
          {
            internalType: "string",
            name: "firstMessageId",
            type: "string",
          },
          {
            internalType: "string",
            name: "cid",
            type: "string",
          },
        ],
        internalType: "struct AbrahamCreations.CreateItem[]",
        name: "items",
        type: "tuple[]",
      },
    ],
    name: "abrahamBatchCreate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        components: [
          {
            internalType: "string",
            name: "messageId",
            type: "string",
          },
          {
            internalType: "string",
            name: "cid",
            type: "string",
          },
        ],
        internalType: "struct AbrahamCreations.OwnerMsg[]",
        name: "items",
        type: "tuple[]",
      },
      {
        internalType: "bool",
        name: "closedAfter",
        type: "bool",
      },
    ],
    name: "abrahamBatchUpdate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "string",
            name: "sessionId",
            type: "string",
          },
          {
            internalType: "string",
            name: "messageId",
            type: "string",
          },
          {
            internalType: "string",
            name: "cid",
            type: "string",
          },
          {
            internalType: "bool",
            name: "closed",
            type: "bool",
          },
        ],
        internalType: "struct AbrahamCreations.UpdateItem[]",
        name: "items",
        type: "tuple[]",
      },
    ],
    name: "abrahamBatchUpdateAcrossSessions",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "abrahamToken",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        internalType: "string",
        name: "messageId",
        type: "string",
      },
      {
        internalType: "string",
        name: "cid",
        type: "string",
      },
      {
        internalType: "bool",
        name: "closed",
        type: "bool",
      },
    ],
    name: "abrahamUpdate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        internalType: "string[]",
        name: "messageIds",
        type: "string[]",
      },
    ],
    name: "batchBlessing",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        internalType: "string[]",
        name: "messageIds",
        type: "string[]",
      },
      {
        internalType: "string[]",
        name: "cids",
        type: "string[]",
      },
    ],
    name: "batchCommandment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        internalType: "string",
        name: "messageId",
        type: "string",
      },
    ],
    name: "blessing",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "blessingRequirement",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        internalType: "string",
        name: "messageId",
        type: "string",
      },
      {
        internalType: "string",
        name: "cid",
        type: "string",
      },
    ],
    name: "commandment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "commandmentRequirement",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        internalType: "string",
        name: "firstMessageId",
        type: "string",
      },
      {
        internalType: "string",
        name: "cid",
        type: "string",
      },
    ],
    name: "createSession",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        internalType: "string",
        name: "messageId",
        type: "string",
      },
    ],
    name: "getMessage",
    outputs: [
      {
        internalType: "address",
        name: "author",
        type: "address",
      },
      {
        internalType: "string",
        name: "cid",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "blessingCount",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
    ],
    name: "getMessageIds",
    outputs: [
      {
        internalType: "string[]",
        name: "",
        type: "string[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
    ],
    name: "getSessionStats",
    outputs: [
      {
        internalType: "uint256",
        name: "messageCount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalCommandments",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "totalBlessings",
        type: "uint256",
      },
      {
        internalType: "bool",
        name: "closed",
        type: "bool",
      },
      {
        internalType: "uint256",
        name: "linkedTotal",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTierCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "getUserLinkInfo",
    outputs: [
      {
        internalType: "uint256",
        name: "linkedAmount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "lastUpdate",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "pointsAccrued",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "getUserTier",
    outputs: [
      {
        internalType: "uint32",
        name: "maxBlessings",
        type: "uint32",
      },
      {
        internalType: "uint32",
        name: "maxCommandments",
        type: "uint32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "user",
        type: "address",
      },
    ],
    name: "getUserTotalLinked",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
    ],
    name: "isSessionClosed",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "sessionTotal",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newAbrahamToken",
        type: "address",
      },
    ],
    name: "setAbrahamToken",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "blessingReq",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "commandmentReq",
        type: "uint256",
      },
    ],
    name: "setRequirements",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newStakingPool",
        type: "address",
      },
    ],
    name: "setStakingPool",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "minStake",
            type: "uint256",
          },
          {
            internalType: "uint32",
            name: "maxBlessingsPerDay",
            type: "uint32",
          },
          {
            internalType: "uint32",
            name: "maxCommandmentsPerDay",
            type: "uint32",
          },
        ],
        internalType: "struct AbrahamCreations.Tier[]",
        name: "newTiers",
        type: "tuple[]",
      },
    ],
    name: "setTiers",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "stakingPool",
    outputs: [
      {
        internalType: "contract IStakingPool",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "tiers",
    outputs: [
      {
        internalType: "uint256",
        name: "minStake",
        type: "uint256",
      },
      {
        internalType: "uint32",
        name: "maxBlessingsPerDay",
        type: "uint32",
      },
      {
        internalType: "uint32",
        name: "maxCommandmentsPerDay",
        type: "uint32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
];
