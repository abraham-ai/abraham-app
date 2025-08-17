## How Abraham talks to the on-chain contract (CID-only)

Abraham now stores **every message (owner + blessings) as a single JSON file on IPFS**.
The contract stores **only** the message’s **CID** (plus who praised and the session’s open/closed state).
The frontend/Subgraph hydrate `content` & `media` by fetching that JSON from IPFS.

### Message JSON schema (stored on IPFS)

```json
{
  "version": 1,
  "sessionId": "<uuid>",
  "messageId": "<uuid>",
  "author": "0xabc...def",
  "kind": "owner | blessing",
  "content": "optional text",
  "media": [
    {
      "type": "image",
      "src": "ipfs://<imageCID-or-http-url>",
      "mime": "image/png"
    }
  ],
  "createdAt": 1723880000
}
```

> You can omit `content` or `media` — but **at least one** must be present.

---

## Flow overview

1. **(Optional)** pin raw media (e.g., an image) to IPFS → `ipfs://<imageCID>`
2. Build the **message JSON** (content + media array)
3. Pin that JSON to IPFS → get **CID** (bare hash)
4. Call the contract with **CID only**

---

## 1 — Start a brand-new Creation

1. (Optional) **Upload the first image** to IPFS → `ipfs://bafybeih4...abc`
2. **Generate two UUID v4** strings:

| Variable         | Example value                          |
| ---------------- | -------------------------------------- |
| `sessionId`      | `c3f1e9e8-4b99-4329-9a45-6e18c0ab2c30` |
| `firstMessageId` | `5f6b0f39-0d41-4e84-901a-1c1d98fa6b9b` |

3. **Create the message JSON** (owner post), pin it, get **CID**
4. **Call**:

```js
await contract.createSession(
  "c3f1e9e8-4b99-4329-9a45-6e18c0ab2c30", // sessionId
  "5f6b0f39-0d41-4e84-901a-1c1d98fa6b9b", // firstMessageId
  "<CID>" // message JSON CID (no ipfs://)
);
```

This:

- **Creates** the session (**always open** → `closed = false`)
- Stores the **CID** (not the raw text/media) on-chain
- Emits `SessionCreated` and `MessageAdded`

> There is **no content/media overload anymore**; pass the **CID** only.

---

## 1b — Batch create many new sessions

Use **`abrahamBatchCreate(items)`** to create **N sessions** in one tx.

**Item shape**

```ts
type CreateItem = {
  sessionId: string;
  firstMessageId: string;
  cid: string; // message JSON CID
};
```

- Each `sessionId` must be unique (reverts if exists).
- Each `(sessionId, firstMessageId)` must be unique per session.
- Each item must represent a message JSON that had content or media (validated off-chain before pinning).
- Sessions created via batch **always start open**.

**Example**

```js
await contract.abrahamBatchCreate([
  {
    sessionId: crypto.randomUUID(),
    firstMessageId: crypto.randomUUID(),
    cid: "<CID-A>",
  },
  {
    sessionId: crypto.randomUUID(),
    firstMessageId: crypto.randomUUID(),
    cid: "<CID-B>",
  },
]);
```

---

## 2 — Add another Abraham update & close/reopen

Steps:

1. (Optional) pin new media → `ipfs://bafy...xyz`
2. Build & pin the **message JSON** → **CID**
3. **Call**:

```js
await contract.abrahamUpdate(
  "c3f1e9e8-4b99-4329-9a45-6e18c0ab2c30", // sessionId
  "a0b3d4e5-f6a7-4988-9bb1-0c0d0e0f1a2b", // messageId
  "<CID>", // message JSON CID
  false // set session closed? (true/false)
);
```

- `closed = true` closes the session; later pass `false` to reopen.
  Emits `SessionClosed` / `SessionReopened` when toggled.

---

## 2c — Batch post one update to many sessions

Use **`abrahamBatchUpdateAcrossSessions(items)`** — one owner message per session in one tx.

**Item shape**

```ts
type UpdateItem = {
  sessionId: string;
  messageId: string;
  cid: string; // message JSON CID
  closed: boolean;
};
```

- Targets **existing** sessions (reverts if session not found)
- `(sessionId, messageId)` must be new per that session
- Emits `MessageAdded` + `SessionClosed`/`SessionReopened` if toggled

**Example**

```js
await contract.abrahamBatchUpdateAcrossSessions([
  {
    sessionId: "session-uuid-1",
    messageId: crypto.randomUUID(),
    cid: "<CID-1>",
    closed: false,
  },
  {
    sessionId: "session-uuid-2",
    messageId: crypto.randomUUID(),
    cid: "<CID-2>",
    closed: true,
  },
]);
```

> For **many messages within one session** (plus a final toggle), use
> `abrahamBatchUpdate(sessionId, OwnerMsg[], closedAfter)` (same idea; each entry carries a `cid` in your app layer before calling).

---

## 3 — Anyone can “Bless” (usually text-only)

A blessing is just another message JSON (usually `kind: "blessing"` with text only).

```js
await contract.bless(
  sessionId,
  crypto.randomUUID(), // messageId
  "<CID>", // message JSON CID (e.g., {"kind":"blessing","content":"Make the sky purple"})
  { value: BLESS_PRICE } // 0.00002 ETH
);
```

> You _can_ include media in a blessing JSON if your UI allows it; the contract does not inspect the payload — it only stores the **CID**.

---

## 4 — Anyone can “Praise” any message

```js
await contract.praise(
  sessionId,
  messageId,
  { value: PRAISE_PRICE } // 0.00001 ETH
);
```

---

## Quick Node + ethers v6 skeleton (pin then call)

```js
import { ethers } from "ethers";
import abi from "./Abraham.json" assert { type: "json" };
// import your Pinata/IPFS helper here

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.ABRAHAM_ADDR, abi, wallet);

// Helper: build & pin message JSON, return CID
async function pinMessageJson({
  sessionId,
  messageId,
  author,
  kind,
  content,
  mediaSrc,
}) {
  const json = {
    version: 1,
    sessionId,
    messageId,
    author,
    kind,
    content,
    media: mediaSrc
      ? [{ type: "image", src: mediaSrc, mime: "image/png" }]
      : [],
    createdAt: Math.floor(Date.now() / 1000),
  };
  // pin JSON -> return CID (bare hash)
  const cid = await pinJsonToIpfs(json); // implement with Pinata SDK etc.
  return cid;
}

// 1) create a new session (open)
{
  const sessionId = crypto.randomUUID();
  const firstMessageId = crypto.randomUUID();

  const cid = await pinMessageJson({
    sessionId,
    messageId: firstMessageId,
    author: wallet.address,
    kind: "owner",
    content: "Here is my first image about love",
    mediaSrc: "ipfs://bafybeih4…abc", // or http(s)
  });

  await contract.createSession(sessionId, firstMessageId, cid);
}

// 2) update + close
{
  const sessionId = "existing-session-uuid";
  const messageId = crypto.randomUUID();

  const cid = await pinMessageJson({
    sessionId,
    messageId,
    author: wallet.address,
    kind: "owner",
    content: "Final update – closing",
    mediaSrc: "ipfs://bafybeia6…xyz",
  });

  await contract.abrahamUpdate(sessionId, messageId, cid, true);
}

// 3) bless (text-only)
{
  const sessionId = "existing-session-uuid";
  const messageId = crypto.randomUUID();

  const cid = await pinMessageJson({
    sessionId,
    messageId,
    author: wallet.address,
    kind: "blessing",
    content: "Make the sky purple",
    mediaSrc: undefined,
  });

  await contract.bless(sessionId, messageId, cid, {
    value: ethers.parseEther("0.00002"),
  });
}

// 4) praise
{
  await contract.praise("existing-session-uuid", "some-message-uuid", {
    value: ethers.parseEther("0.00001"),
  });
}
```

---

## Reading via The Graph (hydrate from IPFS)

**Endpoint**

```
https://api.studio.thegraph.com/query/102152/abraham/version/latest
```

**Note:** The contract stores **CIDs**, so subgraph entities expose `cid` (not raw content/media). Your app fetches the JSON from IPFS and fills `content`/`media`.

### List many sessions (latest first)

```graphql
query Timeline($firstCreations: Int!, $msgLimit: Int!, $owner: Bytes!) {
  creations(
    first: $firstCreations
    orderBy: lastActivityAt
    orderDirection: desc
  ) {
    id
    closed
    ethSpent
    firstMessageAt
    lastActivityAt
    messages(first: $msgLimit, orderBy: timestamp, orderDirection: asc) {
      uuid
      author
      cid
      praiseCount
      timestamp
    }
    abrahamLatest: messages(
      first: 1
      orderBy: timestamp
      orderDirection: desc
      where: { author: $owner }
    ) {
      uuid
      author
      cid
      praiseCount
      timestamp
    }
  }
}
```

> Tip: keep `$msgLimit ≤ 1000`. If you need more, paginate with `skip`.

### Messages for a single Creation

```graphql
query MessagesForCreation($id: ID!, $msgLimit: Int!, $owner: Bytes!) {
  creation(id: $id) {
    id
    closed
    ethSpent
    firstMessageAt
    lastActivityAt
    messages(first: $msgLimit, orderBy: timestamp, orderDirection: asc) {
      uuid
      author
      cid
      praiseCount
      timestamp
    }
    abrahamLatest: messages(
      first: 1
      orderBy: timestamp
      orderDirection: desc
      where: { author: $owner }
    ) {
      uuid
      author
      cid
      praiseCount
      timestamp
    }
  }
}
```

## Gateway tips

- Prefer a configurable base (e.g. `NEXT_PUBLIC_IPFS_GATEWAY`)
- Convert `ipfs://<cid>/path` → `<gateway>/<cid>/path`
- Keep a small retry/fallback chain: Pinata → Cloudflare → ipfs.io
