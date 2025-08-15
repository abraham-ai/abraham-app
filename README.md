## How Abraham talks to the on-chain contract

The **Abraham** contract lets the owner (Abraham) create image–text “Creations” (sessions), add follow-up images, and **optionally close or reopen** a session.  
Anyone can “Bless” (add a text-only message) or “Praise” any message as many times as they like — unless the session has been closed.

> **Optionality:** Owner posts can be **content-only**, **media-only**, or **both**.  
> At least one of `content` or `media` must be non-empty.

---

### 1 — Start a **brand-new Creation**

1. **Upload the first image** to IPFS  
   _Example result_:

[https://gateway.pinata.cloud/ipfs/bafybeih4…abc](https://gateway.pinata.cloud/ipfs/bafybeih4…abc)

````

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
````

That single call …

- **creates** the session (**always open** → `closed = false`)
- stores text + image on-chain
- emits `SessionCreated` **and** `MessageAdded`

> There’s also a **3-arg overload** for content-only:
> `createSession(sessionId, firstMessageId, content)`.

---

### 1b — **Batch** create many new sessions at once

Use **`abrahamBatchCreate(items)`** to create **N sessions** in a single tx.

> Sessions created via batch **always start open** (`closed = false`).

**Item shape**

```ts
type CreateItem = {
  sessionId: string;
  firstMessageId: string;
  content: string; // may be ""
  media: string; // may be ""
};
```

- Each item must have **content or media** (at least one non-empty).
- Each `sessionId` must be unique (reverts if exists).
- Each `(sessionId, firstMessageId)` pair must be unique (reverts if exists).
- Emits one `SessionCreated` and one `MessageAdded` **per item**.

**Example**

```js
await contract.abrahamBatchCreate([
  {
    sessionId: crypto.randomUUID(),
    firstMessageId: crypto.randomUUID(),
    content: "A",
    media: "",
  },
  {
    sessionId: crypto.randomUUID(),
    firstMessageId: crypto.randomUUID(),
    content: "",
    media: "ipfs://bafy…img",
  },
]);
```

---

### 2 — Add another Abraham image / close or reopen

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
| `closed`    | `false` (keep open) or `true` (close session)       |

```js
await contract.abrahamUpdate(
  "c3f1e9e8-4b99-4329-9a45-6e18c0ab2c30",
  "a0b3d4e5-f6a7-4988-9bb1-0c0d0e0f1a2b",
  "Updated the image: added a purple heart",
  "https://gateway.pinata.cloud/ipfs/bafybeia6…xyz",
  false
);
```

> Pass `true` to close; later pass `false` to reopen.
> Contract emits `SessionClosed` / `SessionReopened` accordingly.

---

### 2c — **Batch** post one update to many sessions

Use **`abrahamBatchUpdateAcrossSessions(items)`** to add **one owner message to each target session** in a single tx.

**Item shape**

```ts
type UpdateItem = {
  sessionId: string;
  messageId: string;
  content: string; // may be ""
  media: string; // may be ""
  closed: boolean; // optional conceptually, but must be provided at call time; preserve current if unsure
};
```

- Targets **existing** `sessionId` (reverts if not found).
- `(sessionId, messageId)` must be new.
- Requires **content or media**.
- If `closed` toggles, emits `SessionClosed`/`SessionReopened` per item.

**Example**

```js
await contract.abrahamBatchUpdateAcrossSessions([
  {
    sessionId: "session-uuid-1",
    messageId: crypto.randomUUID(),
    content: "note 1",
    media: "",
    closed: false,
  },
  {
    sessionId: "session-uuid-2",
    messageId: crypto.randomUUID(),
    content: "",
    media: "ipfs://bafy…img2",
    closed: true,
  },
]);
```

> For **many messages within a single session** plus an optional close/reopen toggle, use:
> `abrahamBatchUpdate(sessionId, OwnerMsg[], closedAfter)`.

---

### 3 — Anyone can “Bless” (text-only)

```js
await contract.bless(
  sessionId,
  crypto.randomUUID(),
  "Make the sky purple",
  { value: BLESS_PRICE } // 0.00002 ETH
);
```

---

### 4 — Anyone can “Praise” any message

```js
await contract.praise(
  sessionId,
  messageId,
  { value: PRAISE_PRICE } // 0.00001 ETH
);
```

A praise succeeds unless the session is closed or the exact ETH amount is wrong.

---

### Quick Node + ethers v6 skeleton

```js
import { ethers } from "ethers";
import abi from "./Abraham.json" assert { type: "json" };

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.ABRAHAM_ADDR, abi, wallet);

// 1) brand-new Creation (always open)
await contract.createSession(
  crypto.randomUUID(),
  crypto.randomUUID(),
  "Here is my first image about love",
  "https://gateway.pinata.cloud/ipfs/bafybeih4…abc"
);

// 1b) BATCH create (always open)
await contract.abrahamBatchCreate([
  {
    sessionId: crypto.randomUUID(),
    firstMessageId: crypto.randomUUID(),
    content: "Batch A",
    media: "",
  },
]);

// 2) update + close
await contract.abrahamUpdate(
  "existing-session-uuid",
  crypto.randomUUID(),
  "Final update – closing",
  "https://gateway.pinata.cloud/ipfs/bafybeia6…xyz",
  true
);

// 2c) batch update across sessions
await contract.abrahamBatchUpdateAcrossSessions([
  {
    sessionId: "uuid-1",
    messageId: crypto.randomUUID(),
    content: "note 1",
    media: "",
    closed: false,
  },
]);
```

---

## Reading data via The Graph

Endpoint:

```
https://api.studio.thegraph.com/query/102152/abraham/version/latest
```

### List many sessions

```graphql
query Timeline($firstCreations: Int!, $firstMsgs: Int!) {
  creations(
    first: $firstCreations
    orderBy: lastActivityAt
    orderDirection: desc
    where: { closed: false }
  ) {
    id
    closed
    firstMessageAt
    lastActivityAt
    ethSpent
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

### Messages for a single Creation

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

---

_Each batch operation emits multiple standard events—no special indexing logic needed._
