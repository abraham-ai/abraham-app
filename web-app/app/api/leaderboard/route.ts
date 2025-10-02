import { NextRequest, NextResponse } from "next/server";

// Use the same hardcoded endpoint as the creations API
const SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

// Abraham's owner address - should be excluded from leaderboard
const ABRAHAM_OWNER_ADDRESS = "0x641f5ffC5F6239A0873Bd00F9975091FB035aAFC";

export const revalidate = 30; // Cache for 30 seconds

const LEADERBOARD_QUERY = `
  query GetLeaderboard($first: Int!, $skip: Int!, $owner: Bytes!) {
    curators(
      first: $first
      skip: $skip
      orderBy: totalLinked
      orderDirection: desc
      where: { id_not: $owner }
    ) {
      id
      totalLinked
      praisesGiven
      links {
        pointsAccrued
      }
    }
  }
`;

export interface CuratorData {
  id: string; // address
  totalLinked: string;
  praisesGiven: number;
  blessingsGiven: number;
  totalPoints: string;
  rank: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const first = parseInt(searchParams.get("first") || "50");
    const skip = parseInt(searchParams.get("skip") || "0");

    // Validate pagination params
    if (first > 100) {
      return NextResponse.json(
        { error: "Maximum 100 curators per request" },
        { status: 400 }
      );
    }

    const variables = {
      first,
      skip,
      owner: ABRAHAM_OWNER_ADDRESS.toLowerCase(),
    };

    const requestBody = {
      query: LEADERBOARD_QUERY,
      variables,
    };

    console.log("Sending request to subgraph:");
    console.log("URL:", SUBGRAPH_URL);
    console.log("Body:", JSON.stringify(requestBody, null, 2));

    // Also fetch blessing count for each curator
    const BLESSINGS_QUERY = `
      query GetBlessings($curators: [Bytes!]!, $owner: Bytes!) {
        messages(
          where: { 
            author_in: $curators
            author_not: $owner
          }
        ) {
          author
        }
      }
    `;

    const response = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Subgraph response status:", response.status);
    console.log(
      "Subgraph response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Subgraph error response:", errorText);
      throw new Error(
        `Subgraph request failed: ${response.status} ${response.statusText}`
      );
    }

    const responseText = await response.text();
    console.log("Raw subgraph response:", responseText.substring(0, 500));

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      throw new Error(
        `Invalid JSON response from subgraph: ${responseText.substring(0, 200)}`
      );
    }

    if (data.errors) {
      console.error("Subgraph returned errors:", data.errors);
      throw new Error(`Subgraph errors: ${JSON.stringify(data.errors)}`);
    }

    if (!data.data || !Array.isArray(data.data.curators)) {
      console.error("Unexpected response structure:", data);
      // Return empty result instead of error if no curators found
      return NextResponse.json({
        curators: [],
        pagination: {
          first,
          skip,
          hasMore: false,
        },
      });
    }

    // Get curator addresses for blessing count query
    const curatorAddresses = data.data.curators.map((c: any) => c.id);

    // Fetch blessing counts for these curators
    let blessingCounts: Record<string, number> = {};
    if (curatorAddresses.length > 0) {
      try {
        const blessingsResponse = await fetch(SUBGRAPH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            query: `
              query GetBlessings($curators: [Bytes!]!, $owner: Bytes!) {
                messages(
                  where: { 
                    author_in: $curators
                    author_not: $owner
                  }
                ) {
                  author
                }
              }
            `,
            variables: {
              curators: curatorAddresses,
              owner: ABRAHAM_OWNER_ADDRESS.toLowerCase(),
            },
          }),
        });

        if (blessingsResponse.ok) {
          const blessingsData = await blessingsResponse.json();
          if (blessingsData.data?.messages) {
            // Count blessings per curator
            blessingsData.data.messages.forEach((msg: any) => {
              const author = msg.author.toLowerCase();
              blessingCounts[author] = (blessingCounts[author] || 0) + 1;
            });
          }
        }
      } catch (error) {
        console.warn("Failed to fetch blessing counts:", error);
      }
    }

    const curators: CuratorData[] = data.data.curators.map(
      (curator: any, index: number) => {
        // Calculate total points from all curator links
        const totalPoints = (curator.links || []).reduce(
          (sum: bigint, link: any) => {
            return sum + BigInt(link.pointsAccrued || "0");
          },
          BigInt(0)
        );

        const curatorId = curator.id.toLowerCase();
        const blessingsGiven = blessingCounts[curatorId] || 0;

        return {
          id: curator.id,
          totalLinked: curator.totalLinked || "0",
          praisesGiven: curator.praisesGiven || 0,
          blessingsGiven,
          totalPoints: totalPoints.toString(),
          rank: skip + index + 1,
        };
      }
    );

    // Sort by total points (descending) then by total linked (descending)
    curators.sort((a, b) => {
      const pointsA = BigInt(a.totalPoints);
      const pointsB = BigInt(b.totalPoints);

      if (pointsA !== pointsB) {
        return pointsA > pointsB ? -1 : 1;
      }

      // If points are equal, sort by total linked
      const linkedA = BigInt(a.totalLinked);
      const linkedB = BigInt(b.totalLinked);
      return linkedA > linkedB ? -1 : 1;
    });

    // Reassign ranks after sorting
    curators.forEach((curator, index) => {
      curator.rank = skip + index + 1;
    });

    console.log(`Returning ${curators.length} curators`);

    return NextResponse.json({
      curators,
      pagination: {
        first,
        skip,
        hasMore: curators.length === first,
      },
    });
  } catch (error: any) {
    console.error("Leaderboard API error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to fetch leaderboard data",
        details: error.stack || error.toString(),
      },
      { status: 500 }
    );
  }
}
