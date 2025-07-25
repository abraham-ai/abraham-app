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
  ethSpent: string;
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
}

export interface CreationItem {
  id: string;
  image: string;
  description: string;
  praiseCount: number;
  messageUuid: string;
  ethTotal: number;
  blessingCnt: number;
  firstMessageAt: string;
  lastActivityAt: string;
  blessings: Blessing[];
  messages: SubgraphMessage[];
}
