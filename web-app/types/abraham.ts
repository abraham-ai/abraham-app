/*──────────────────────────────*
 | Raw subgraph return types    |
 *──────────────────────────────*/
export interface SubgraphCreation {
  id: string; // == sessionId
  abrahamMessageCount: number;
  blessingCount: number;
  ethSpentTotal: string; // wei
  abrahamMessages: {
    index: number;
    content: string;
    media: string; // ipfs://… or https://…
    praiseCount: number;
  }[];
  blessings: {
    author: string;
    content: string;
    praiseCount: number;
    timestamp: string; // BigInt as string
  }[];
  praises: {
    praiser: string;
    timestamp: string;
  }[];
}

/*──────────────────────────────*
 | Normalised for the UI        |
 *──────────────────────────────*/
export interface CreationItem {
  id: string;
  // derived / formatted
  image: string; // HTTP gateway URL for media
  description: string; // AbrahamMessage.content
  ethTotal: number; // ETH (not wei)
  praiseCount: number;
  blessingCnt: number;
  // raw
  blessings: SubgraphCreation["blessings"];
}
/* A single Blessing after mapping */
export type Blessing = CreationItem["blessings"][number];
