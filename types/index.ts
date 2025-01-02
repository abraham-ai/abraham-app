export interface SubgraphCreation {
  id: string;
  creationId: string;
  metadataUri: string;
  totalStaked: string; // Represented as a string because GraphQL's BigInt is returned as a string
  praisePool: string;
  conviction: string;
  createdAt: string; // Unix timestamp as a string
  updatedAt: string;
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
}
