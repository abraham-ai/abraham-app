export interface StoryItem {
  id: string;
  logline: string;
  poster_image: string;
  poster_thumbnail: string;
  praises: string[];
  burns: string[];
  blessings: Blessing[];
  stills: string[];
}

export interface Blessing {
  user: string;
  blessing: string;
}
