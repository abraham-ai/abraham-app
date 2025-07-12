/* ---------- raw subgraph shapes ---------- */
export interface SubgraphMessage {
  index: number;
  author: string;
  content: string;
  media: string | null;
  praiseCount: number;
  timestamp: string; // seconds since epoch
}

export interface SubgraphCreation {
  id: string;
  messageCount: number;
  ethSpent: string; // BigInt (wei)
  messages: SubgraphMessage[];
}

/* ---------- UI shapes ---------- */
export interface Blessing {
  author: string;
  content: string;
  praiseCount: number;
  timestamp?: string;
}

export interface CreationItem {
  id: string;

  /* thumbnail info (latest Abraham msg) */
  image: string;
  description: string;
  praiseCount: number;
  messageIndex: number; // index of latest Abraham msg (needed for praise)

  /* stats */
  ethTotal: number;
  blessingCnt: number;
  blessings: Blessing[];

  /* full chronological list (Abraham + blessings) */
  messages: SubgraphMessage[]; // ← NEW
}
