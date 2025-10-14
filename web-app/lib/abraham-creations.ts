import { unstable_cache } from 'next/cache';
import { getCollection } from './mongodb';
import { ObjectId } from 'mongodb';

export interface AbrahamCreation {
  _id: ObjectId;
  createdAt: Date;
  creation?: {
    index: number;
    title: string;
    tagline: string;
    poster_image: string;
    blog_post: string;
    tx_hash: string;
    ipfs_hash: string;
    explorer_url: string;
  };
  proposal: string;
  session_id: ObjectId;
  status: string;
  title: string;
  updatedAt: Date;
}

// Fetch all Abraham creations from MongoDB
async function fetchAbrahamCreationsFromDB(): Promise<any[]> {
  try {
    const collection = await getCollection('abraham_seeds', 'eden-prod');
    const creations = await collection.find({}).sort({ createdAt: -1 }).toArray();

    // Convert MongoDB documents to plain objects for JSON serialization
    return creations.map(creation => ({
      _id: creation._id.toString(),
      createdAt: creation.createdAt instanceof Date ? creation.createdAt.toISOString() : creation.createdAt,
      creation: creation.creation,
      proposal: creation.proposal,
      session_id: creation.session_id?.toString(),
      status: creation.status,
      title: creation.title,
      updatedAt: creation.updatedAt instanceof Date ? creation.updatedAt.toISOString() : creation.updatedAt
    }));
  } catch (error) {
    console.error('Error fetching Abraham creations:', error);
    throw new Error('Failed to fetch Abraham creations');
  }
}

// Cache the database query with Next.js unstable_cache
// Revalidate every 60 seconds
export const getAbrahamCreations = unstable_cache(
  fetchAbrahamCreationsFromDB,
  ['abraham-creations'],
  {
    revalidate: 60, // Revalidate every 60 seconds
    tags: ['abraham-creations'] // Tag for on-demand revalidation
  }
);