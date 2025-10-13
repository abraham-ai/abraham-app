export const SystemPromptPayPatchAbi = [
  {
    inputs: [
      {
        internalType: "string",
        name: "initialText",
        type: "string",
      },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "version",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "editor",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "bytesChanged",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "weiCharged",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "newLength",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "contentHash",
        type: "bytes32",
      },
    ],
    name: "Patched",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "newWei",
        type: "uint256",
      },
    ],
    name: "PriceChanged",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "bytes",
        name: "ops",
        type: "bytes",
      },
    ],
    name: "applyPatch",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "latestVersion",
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
    name: "pricePerByte",
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
        name: "weiPerByte",
        type: "uint256",
      },
    ],
    name: "setPrice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "text",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "v",
        type: "uint256",
      },
    ],
    name: "textAt",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
];
