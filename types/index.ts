export interface CreationItem {
  _id: string;
  creation: {
    title: string;
    description: string;
    visual_aesthetic: string;
  };
  result: {
    output: Array<{
      mediaAttributes: {
        mimeType: string;
        width: number;
        height: number;
        aspectRatio: number;
      };
      url: string;
    }>;
    status: string;
  };
  praises: string[];
  burns: string[];
  blessings: Array<{
    blessing: string;
    user: string;
  }>;
  stills?: string[]; // If applicable
  onchain?: {
    id: string;
    metadataUri: string;
    totalStaked: string;
    praisePool: number;
    conviction: string;
  };
}

export interface Blessing {
  user: string;
  blessing: string;
}
