/* ────────── Raw entity from subgraph ────────── */
export interface SubgraphCreation {
  id: string;
  createdAt: string;
  abrahamMessageCount: number;
  blessingCount: number;
  ethSpentTotal: string;
  abrahamMessages: {
    index: number;
    content: string;
    media: string;
    praiseCount: number;
    timestamp: string;
  }[];
  blessings: {
    author: string;
    content: string;
    praiseCount: number;
    timestamp: string;
  }[];
}

/* ────────── Normalised for the UI ────────── */
export interface CreationItem {
  id: string;
  createdAt: string;
  image: string;
  description: string;
  latestIndex: number;
  msgTimestamp: string;

  ethTotal: number;
  praiseCount: number;
  blessingCnt: number;

  blessings: {
    author: string;
    content: string;
    praiseCount: number;
    timestamp: string;
  }[];
}

export type Blessing = CreationItem["blessings"][number];
