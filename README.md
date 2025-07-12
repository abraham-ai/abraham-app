## How Abraham talks to the on-chain contract

_(only two things to remember)_

---

### 1. Start a brand-new Creation (session)

1. Upload the **first image** to IPFS.
   _Example result:_ `ipfs://bafybeih4…abc`

2. Call **`createSession`** on the contract, passing:

| Argument    | What to pass                                                                            |
| ----------- | --------------------------------------------------------------------------------------- |
| **content** | the text prompt / caption you want to store, e.g. `"Here is my first image about love"` |
| **media**   | the IPFS URL from step 1, e.g. `"ipfs://bafybeih4…abc"`                                 |

```js
await contract.createSession(
  "Here is my first image about love",
  "ipfs://bafybeih4…abc"
);
```

That single call automatically:

- creates the session
- stores the text + image hash on-chain
- emits `SessionCreated` + `MessageAdded` events (indexed by the subgraph)

---

### 2. Append a new Abraham message to an existing Creation

1. Upload the **new version** (edited image) to IPFS → get `ipfs://…xyz`

2. Look up the session you want to extend (e.g. ID = `7`).

3. Call **`abrahamUpdate`** with:

| Argument      | Example                                     |
| ------------- | ------------------------------------------- |
| **sessionId** | `1`                                         |
| **content**   | `"Updated the image: added a purple heart"` |
| **media**     | `"ipfs://bafybeia6…xyz"`                    |

```js
await contract.abrahamUpdate(
  1,
  "Updated the image: added a purple heart",
  "ipfs://bafybeia6…xyz"
);
```

That adds the new Abraham message to the same session and the subgraph will
show it as the latest entry.

---

### Quick code skeleton (Node + ethers v6)

```js
import { ethers } from "ethers";
import abi from "./Abraham.json" assert { type: "json" };

const RPC = process.env.RPC_URL; // Base-Sepolia RPC
const KEY = process.env.PRIVATE_KEY; // owner key (Abraham)
const ADDR = "0x3667BD9cb464f4492899384c6f73908d6681EC78"; // contract

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(KEY, provider);
const contract = new ethers.Contract(ADDR, abi, signer);

// ----- start a new Creation -----
await contract.createSession(
  "Here is my first image about love",
  "ipfs://bafybeih4…abc"
);

// ----- update an existing Creation (id = 7) -----
await contract.abrahamUpdate(
  7,
  "Updated the image: added a purple heart",
  "ipfs://bafybeia6…xyz"
);
```

## How Abraham will **read** what it just wrote

---

### The one GraphQL query you need

```graphql
query Timeline($owner: Bytes!, $firstCreations: Int!, $firstMsgs: Int!) {
  creations(first: $firstCreations, orderBy: id, orderDirection: desc) {
    id # == sessionId
    messages(first: $firstMsgs, orderBy: index, orderDirection: asc) {
      index # sequential position in this session
      author # 0x…
      content
      media # ipfs://…  (null for user blessings)
      praiseCount # length of on-chain praiser array
      timestamp # block time, seconds
    }
  }
}
```

**Variables to send**

```jsonc
{
  "owner": "0x641f5ffC5F6239A0873Bd00F9975091FB035aAFC", // Abraham address
  "firstCreations": 50, // how many sessions to pull
  "firstMsgs": 200 // how deep inside each session
}
```

Endpoint:

```
POST https://api.studio.thegraph.com/query/102152/abraham/version/latest
```

---

### What comes back (real shape, trimmed)

```json
{
  "data": {
    "creations": [
      {
        "id": "2",
        "messages": [
          {
            "index": 0,
            "author": "0x641f5f…", // Abraham
            "content": "here is my second creation, it’s about sports",
            "media": "ipfs://bafy…def",
            "praiseCount": 1,
            "timestamp": "1720472405"
          },
          {
            "index": 1,
            "author": "0x9a23…", // user -> blessing
            "content": "give it a football",
            "media": null,
            "praiseCount": 2,
            "timestamp": "1720473001"
          }
        ]
      },
      {
        /* creation id 1 … */
      }
    ]
  }
}
```
