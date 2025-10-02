export interface SubgraphMessage {
  uuid: string;
  author: string;
  content: string;
  media: string | null;
  praiseCount: number;
  timestamp: string;
}

export interface SubgraphCreation {
  id: string;
  sessionIdRaw?: string;
  closed: boolean;
  linkedTotal: string;
  totalBlessings: number;
  totalPraises: number;
  firstMessageAt: string;
  lastActivityAt: string;
  messages: SubgraphMessage[];
}

export interface Blessing {
  author: string;
  content: string;
  praiseCount: number;
  timestamp: string;
  messageUuid: string;
  creationId: string;
  sessionIdRaw?: string;
}

export interface CreationItem {
  id: string;
  sessionIdRaw?: string;
  closed: boolean;
  image: string;
  description: string;
  praiseCount: number;
  messageUuid: string;
  linkedTotal: number;
  totalBlessings: number;
  totalPraises: number;
  blessingCnt: number;
  firstMessageAt: string;
  lastActivityAt: string;
  blessings: Blessing[];
  messages: SubgraphMessage[];
  timestamp?: string; // Individual message timestamp
}
