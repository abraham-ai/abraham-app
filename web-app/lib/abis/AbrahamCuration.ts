export const AbrahamCurationAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "stakingPool_",
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
        internalType: "string",
        name: "sessionId",
        type: "string",
      },
      {
        indexed: true,
        internalType: "string",
        name: "targetId",
        type: "string",
      },
      {
        indexed: true,
        internalType: "address",
        name: "actor",
        type: "address",
      },
      {
        indexed: false,
        internalType: "address",
        name: "stakeHolder",
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
        indexed: false,
        internalType: "uint256",
        name: "stakePerBlessing",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "periodSeconds",
        type: "uint256",
      },
    ],
    name: "BlessingParamsUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "stakeHolder",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "delegate",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bool",
        name: "approved",
        type: "bool",
      },
    ],
    name: "DelegateApproval",
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
        internalType: "address",
        name: "delegate",
        type: "address",
      },
      {
        internalType: "bool",
        name: "approved",
        type: "bool",
      },
    ],
    name: "approveDelegate",
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
        name: "targetIds",
        type: "string[]",
      },
      {
        internalType: "address",
        name: "stakeHolder",
        type: "address",
      },
    ],
    name: "batchBless",
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
        name: "targetId",
        type: "string",
      },
      {
        internalType: "address",
        name: "stakeHolder",
        type: "address",
      },
    ],
    name: "bless",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "stakeHolder",
        type: "address",
      },
    ],
    name: "capacityPerPeriod",
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
    inputs: [],
    name: "getAllBlessings",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "actor",
            type: "address",
          },
          {
            internalType: "address",
            name: "stakeHolder",
            type: "address",
          },
          {
            internalType: "string",
            name: "sessionId",
            type: "string",
          },
          {
            internalType: "string",
            name: "targetId",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
        ],
        internalType: "struct AbrahamCuration.BlessingRecord[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "actor",
        type: "address",
      },
    ],
    name: "getBlessingsByActor",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "actor",
            type: "address",
          },
          {
            internalType: "address",
            name: "stakeHolder",
            type: "address",
          },
          {
            internalType: "string",
            name: "sessionId",
            type: "string",
          },
          {
            internalType: "string",
            name: "targetId",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
        ],
        internalType: "struct AbrahamCuration.BlessingRecord[]",
        name: "",
        type: "tuple[]",
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
    name: "getBlessingsBySession",
    outputs: [
      {
        components: [
          {
            internalType: "address",
            name: "actor",
            type: "address",
          },
          {
            internalType: "address",
            name: "stakeHolder",
            type: "address",
          },
          {
            internalType: "string",
            name: "sessionId",
            type: "string",
          },
          {
            internalType: "string",
            name: "targetId",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "timestamp",
            type: "uint256",
          },
        ],
        internalType: "struct AbrahamCuration.BlessingRecord[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    name: "isDelegateApproved",
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
    name: "periodSeconds",
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
        name: "stakeHolder",
        type: "address",
      },
    ],
    name: "remainingCredits",
    outputs: [
      {
        internalType: "uint256",
        name: "credits",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "capacity",
        type: "uint256",
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
    inputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    name: "sessionBlessingCount",
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
        internalType: "uint256",
        name: "newStakePerBlessing",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "newPeriodSeconds",
        type: "uint256",
      },
    ],
    name: "setBlessingParams",
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
    inputs: [],
    name: "stakePerBlessing",
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
        name: "user",
        type: "address",
      },
    ],
    name: "stakedBalance",
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
        internalType: "string",
        name: "",
        type: "string",
      },
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    name: "targetBlessingCount",
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
    inputs: [],
    name: "totalBlessings",
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
