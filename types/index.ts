export interface SubgraphCreation {
  id: string;
  creationId: string;
  metadataUri: string;
  totalMannaUsed: string; // Represented as a string because GraphQL's BigInt is returned as a string
  blessCount: string;
  praiseCount: string;
  burnCount: string;
  currentPriceToPraise: number;
  createdAt: string; // Unix timestamp as a string
  updatedAt: string;
  praises: [
    {
      userAddress: string;
      noOfPraises: number;
      mannaUsed: number;
    }
  ];
  burns: [
    {
      userAddress: string;
      noOfBurns: number;
      mannaUsed: number;
    }
  ];
  blessings: [
    {
      userAddress: string;
      message: string;
      mannaUsed: number;
    }
  ];
}

export interface Metadata {
  title: string;
  description: string;
  visual_aesthetic: string;
  image: string; // URL to the image
}

export interface CreationItem extends SubgraphCreation, Metadata {}

export interface Blessing {
  user: string;
  blessing: string;
  mannaUsed: number;
}
