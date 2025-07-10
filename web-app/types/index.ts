export interface SubgraphCreation {
  id: string;
  creationId: string;
  metadataUri: string;

  // Represent these as strings of Wei
  totalEthUsed: string;
  currentPriceToPraise: string;

  blessCount: string;
  praiseCount: string;
  burnCount: string;
  createdAt: string;
  updatedAt: string;
  praises: Array<{
    userAddress: string;
    noOfPraises: number;
    ethUsed: string; // Also Wei in string form
  }>;
  burns: Array<{
    userAddress: string;
    noOfBurns: number;
    ethUsed: string;
  }>;
  blessings: Array<{
    blockTimestamp: string;
    userAddress: string;
    message: string;
    ethUsed: string;
  }>;
}

export interface Metadata {
  title: string;
  description: string;
  visual_aesthetic: string;
  image: string; // URL to the image
}
export interface Blessing {
  user?: string;
  userAddress?: string;
  blessing?: string;
  message?: string;
  blockTimestamp?: string;
}

export interface CreationItem extends SubgraphCreation, Metadata {}
