## How Abraham talks to the on-chain contract

The **Abraham** contract lets the owner (Abraham) create image–text “Creations”
(sessions), add follow-up images, and **optionally close or reopen** a session.
Anyone can “Bless” (add a text-only message) or “Praise” any message as many
times as they like—unless the session has been closed.

---

### 1 Start a **brand-new Creation**

1. **Upload the first image** to IPFS
   _Example result_

   ```
   https://gateway.pinata.cloud/ipfs/bafybeih4…abc
   ```

2. **Generate two fresh UUID v4 strings**

| Variable         | Example value                          |
| ---------------- | -------------------------------------- |
| `sessionId`      | `c3f1e9e8-4b99-4329-9a45-6e18c0ab2c30` |
| `firstMessageId` | `5f6b0f39-0d41-4e84-901a-1c1d98fa6b9b` |

3. **Call `createSession`** (owner-only):

| Argument         | What to pass                                          |
| ---------------- | ----------------------------------------------------- |
| `sessionId`      | New session UUID                                      |
| `firstMessageId` | UUID of the first Abraham post                        |
| `content`        | Any text / caption, e.g. `"Here is my first image …"` |
| `media`          | The IPFS URL from step 1                              |

```js
await contract.createSession(
  "c3f1e9e8-4b99-4329-9a45-6e18c0ab2c30", // sessionId
  "5f6b0f39-0d41-4e84-901a-1c1d98fa6b9b", // firstMessageId
  "Here is my first image about love",
  "https://gateway.pinata.cloud/ipfs/bafybeih4…abc"
);
```

That single call …

- **creates** the session (`closed = false`)
- stores text + image on-chain
- emits `SessionCreated` **and** `MessageAdded`

---

### 2 Add another Abraham image / close or reopen

1. Upload the next image to IPFS → e.g.

   ```
   https://gateway.pinata.cloud/ipfs/bafybeia6…xyz
   ```

2. Choose the `sessionId` to extend and a fresh `messageId`.

3. **Call `abrahamUpdate`** (owner-only):

| Argument    | Example value                                       |
| ----------- | --------------------------------------------------- |
| `sessionId` | `c3f1e9e8-4b99-4329-9a45-6e18c0ab2c30`              |
| `messageId` | `a0b3d4e5-f6a7-4988-9bb1-0c0d0e0f1a2b`              |
| `content`   | `"Updated the image: added a purple heart"`         |
| `media`     | `"https://gateway.pinata.cloud/ipfs/bafybeia6…xyz"` |
| `closed`    | `false` (keep open) **or** `true` (close session)   |

```js
await contract.abrahamUpdate(
  "c3f1e9e8-4b99-4329-9a45-6e18c0ab2c30",
  "a0b3d4e5-f6a7-4988-9bb1-0c0d0e0f1a2b",
  "Updated the image: added a purple heart",
  "https://gateway.pinata.cloud/ipfs/bafybeia6…xyz",
  /* closed */ false
);
```

_Pass `true` in the last slot to **close** the session;
pass `false` later to **reopen** it.
The contract emits `SessionClosed` or `SessionReopened` accordingly._

---

### 3 Anyone can “Bless” (text-only)

```js
await contract.bless(
  sessionId,
  crypto.randomUUID(), // messageId
  "Make the sky purple", // text
  { value: BLESS_PRICE } // 0.00002 ETH
);
```

---

### 4 Anyone can “Praise” **any** message (unlimited)

```js
await contract.praise(
  sessionId,
  messageId, // any existing message
  { value: PRAISE_PRICE } // 0.00001 ETH
);
```

A praise always succeeds unless the session is closed or the exact ETH amount
is wrong.

---

### Quick Node + ethers v6 skeleton

```js
import { ethers } from "ethers";
import abi from "./Abraham.json" assert { type: "json" };

const RPC = process.env.RPC_URL; // Base-Sepolia RPC
const KEY = process.env.PRIVATE_KEY; // owner key (Abraham)
const ADDR = "0x15a5Dc6E5fe17d2ACfeb7c64F348f7643645BdF7";

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(KEY, provider);
const contract = new ethers.Contract(ADDR, abi, wallet);

// brand-new Creation
await contract.createSession(
  crypto.randomUUID(), // sessionId
  crypto.randomUUID(), // firstMessageId
  "Here is my first image about love",
  "https://gateway.pinata.cloud/ipfs/bafybeih4…abc"
);

// owner appends an update and closes the session
await contract.abrahamUpdate(
  "existing-session-uuid",
  crypto.randomUUID(),
  "Final update – closing the session",
  "https://gateway.pinata.cloud/ipfs/bafybeia6…xyz",
  true // closed = true
);
```

---

## Reading data via The Graph subgraph

Endpoint
`https://api.studio.thegraph.com/query/102152/abraham/version/latest`

### 1 List many sessions (open by default)

```graphql
query Timeline($firstCreations: Int!, $firstMsgs: Int!) {
  creations(
    first: $firstCreations
    orderBy: lastActivityAt
    orderDirection: desc
    where: { closed: false } # hide closed sessions
  ) {
    id
    closed # Boolean
    firstMessageAt
    lastActivityAt
    ethSpent # Wei spent on bless + praise
    messages(first: $firstMsgs, orderBy: timestamp, orderDirection: asc) {
      uuid
      author
      content
      media
      praiseCount
      timestamp
      praises {
        praiser
        timestamp
      }
    }
  }
}
```

Variables example

```json
{
  "firstCreations": 50,
  "firstMsgs": 200
}
```

---

### 2 Messages for a single Creation (open **or** closed)

```graphql
query MessagesForCreation($id: ID!, $firstMsgs: Int!) {
  creation(id: $id) {
    id
    closed
    messages(first: $firstMsgs, orderBy: timestamp, orderDirection: asc) {
      uuid
      author
      content
      media
      praiseCount
      timestamp
      praises {
        praiser
        timestamp
      }
    }
  }
}
```

Variables example

```json
{
  "id": "c3f1e9e8-4b99-4329-9a45-6e18c0ab2c30",
  "firstMsgs": 100
}
```

---

### Sample response (trimmed)

```json
{
  "data": {
    "creation": {
      "id": "c3f1e9e8-4b99-4329-9a45-6e18c0ab2c30",
      "closed": false,
      "messages": [
        {
          "uuid": "5f6b0f39-0d41-4e84-901a-1c1d98fa6b9b",
          "author": "0x641f…", // Abraham
          "content": "Here is my first image about love",
          "media": "https://gateway.pinata.cloud/ipfs/bafybeih4…abc",
          "praiseCount": 2,
          "timestamp": "1720472405",
          "praises": [
            { "praiser": "0x9a23…", "timestamp": "1720472600" },
            { "praiser": "0x7eF4…", "timestamp": "1720472650" }
          ]
        },
        {
          "uuid": "a0b3d4e5-f6a7-4988-9bb1-0c0d0e0f1a2b",
          "author": "0xd930…", // user blessing
          "content": "Give it a football",
          "media": null,
          "praiseCount": 3,
          "timestamp": "1720473001",
          "praises": [
            { "praiser": "0xABCD…", "timestamp": "1720473050" },
            { "praiser": "0xEF01…", "timestamp": "1720473102" },
            { "praiser": "0x9a23…", "timestamp": "1720473155" }
          ]
        }
      ]
    }
  }
}
```

_Every `praise` is recorded individually, so `praiseCount` is always the exact
total—even when the same address praises multiple times._
