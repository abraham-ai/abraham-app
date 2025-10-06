import { NextRequest, NextResponse } from "next/server";

// Use the same hardcoded endpoint as the creations API
const SUBGRAPH_URL =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

// Abraham's owner address - should be excluded from leaderboard
const ABRAHAM_OWNER_ADDRESS = "0x641f5ffC5F6239A0873Bd00F9975091FB035aAFC";

export const revalidate = 0; // Disable caching for now to debug
export const dynamic = "force-dynamic"; // Force dynamic rendering

const LEADERBOARD_QUERY = `
  query GetLeaderboard($owner: Bytes!) {
    curators(
      first: 1000
      orderBy: praisesGiven
      orderDirection: desc
      where: { id_not: $owner }
    ) {
      id
      totalLinked
      praisesGiven
      praisesReceived
      links {
        linkedAmount
        pointsAccrued
        lastUpdate
      }
    }
  }
`;

export interface CuratorData {
  id: string; // address
  totalLinked: string;
  praisesGiven: number;
  praisesReceived: number;
  blessingsGiven: number;
  totalPoints: string;
  rank: number;
  maxStakeDays: number; // longest duration stake has been active
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

    // Fetch more curators than requested to ensure proper sorting
    // We'll apply pagination after calculating composite scores
    const fetchLimit = Math.min(1000, skip + first * 5); // Fetch 5x pages ahead

    const variables = {
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
    const blessingCounts: Record<string, number> = {};
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
        const curatorId = curator.id.toLowerCase();
        const blessingsGiven = blessingCounts[curatorId] || 0;

        // Log raw curator data for first 3
        if (index < 3) {
          console.log(`\nCurator #${index + 1}:`, {
            id: curatorId.substring(0, 10),
            totalLinked: curator.totalLinked,
            praisesGiven: curator.praisesGiven,
            praisesReceived: curator.praisesReceived,
            linksCount: curator.links?.length || 0,
            links: curator.links?.map((l: any) => ({
              linked: l.linkedAmount,
              points: l.pointsAccrued,
            })),
          });
        }

        // Calculate total points from all curator links
        // IMPORTANT: Each link independently accrues (linkedAmount × time)
        // If a user stakes 50 tokens for 30 days on Creation A, then 30 tokens for 10 days on Creation B:
        // - Link A pointsAccrued: 50 × 30 days (in wei-seconds)
        // - Link B pointsAccrued: 30 × 10 days (in wei-seconds)
        // Total = sum of both = properly accounts for different staking times!
        const totalPointsWeiSeconds = (curator.links || []).reduce(
          (sum: bigint, link: any) => {
            return sum + BigInt(link.pointsAccrued || "0");
          },
          BigInt(0)
        );

        console.log(
          `Raw pointsAccrued for ${curatorId.substring(0, 10)}:`,
          totalPointsWeiSeconds.toString()
        );

        // Create a composite score that balances different factors:
        // 1. Activity: praises + blessings (weighted higher)
        // 2. Engagement: praises received
        // 3. Commitment: total stake
        // 4. Time-weighted stake: normalized points

        const praisesGiven = curator.praisesGiven || 0;
        const praisesReceived = curator.praisesReceived || 0;
        const totalLinked = BigInt(curator.totalLinked || "0");

        // Normalize points: divide by 1e18 (wei to tokens) and by ~1 day in seconds (86400)
        // This gives us roughly "token-days" as a unit
        // Example: 100 tokens staked for 5 days = 100e18 * 432000 / (86400 * 1e18) = 500 token-days
        // Divisor = 86400 * 1e18 = 86400000000000000000000 (8.64e22)
        const SECONDS_PER_DAY = BigInt(86400);
        const WEI_PER_TOKEN = BigInt("1000000000000000000"); // 1e18
        const normalizedPoints =
          totalPointsWeiSeconds / (SECONDS_PER_DAY * WEI_PER_TOKEN);

        console.log(
          `Normalized points for ${curatorId.substring(
            0,
            10
          )}: ${normalizedPoints} token-days`
        );

        // Calculate max stake duration (time since earliest lastUpdate)
        // NOTE: This shows the LONGEST single staking duration, not a weighted average
        // A user might have multiple stakes at different times - this just shows the oldest one
        const now = Math.floor(Date.now() / 1000); // Current time in seconds
        let maxStakeDuration = 0;

        if (curator.links && curator.links.length > 0) {
          // Find the earliest lastUpdate (when stake was first linked)
          const earliestUpdate = curator.links.reduce(
            (min: number, link: any) => {
              const lastUpdate = parseInt(link.lastUpdate || "0");
              return lastUpdate > 0 && (min === 0 || lastUpdate < min)
                ? lastUpdate
                : min;
            },
            0
          );

          if (earliestUpdate > 0) {
            maxStakeDuration = now - earliestUpdate;
          }
        }

        const maxStakeDays = Math.floor(maxStakeDuration / 86400);

        // Composite score calculation:
        // - Praises given: 10 points each (primary activity)
        // - Blessings given: 20 points each (higher value action)
        // - Praises received: 5 points each (quality indicator)
        // - Time-weighted stake: stake × duration (pointsAccrued normalized to token-days)
        //   This makes time a multiplier on stake, not an additive component
        const activityScore =
          BigInt(praisesGiven * 10) +
          BigInt(blessingsGiven * 20) +
          BigInt(praisesReceived * 5);

        const stakeTimeScore = normalizedPoints; // Already stake × time in token-days

        const compositeScore = activityScore + stakeTimeScore;

        console.log(
          `Curator ${curatorId.substring(
            0,
            10
          )}: praises=${praisesGiven}, blessings=${blessingsGiven}, received=${praisesReceived}, activity=${activityScore.toString()}, stakeTime=${stakeTimeScore.toString()}, maxDays=${maxStakeDays}, FINAL SCORE=${compositeScore.toString()}`
        );

        return {
          id: curator.id,
          totalLinked: curator.totalLinked || "0",
          praisesGiven,
          praisesReceived,
          blessingsGiven,
          totalPoints: compositeScore.toString(),
          rank: 0, // Will be set after sorting
          maxStakeDays,
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

    // Reassign ranks after sorting (global ranks, not page-relative)
    curators.forEach((curator, index) => {
      curator.rank = index + 1;
    });

    // Apply pagination AFTER sorting
    const totalCurators = curators.length;
    const paginatedCurators = curators.slice(skip, skip + first);

    console.log(`========== LEADERBOARD RESULTS ==========`);
    console.log(`Total curators: ${totalCurators}`);
    console.log(
      `Returning ${paginatedCurators.length} curators (skip: ${skip}, first: ${first})`
    );
    console.log(
      `Top 3 scores:`,
      paginatedCurators.slice(0, 3).map((c) => ({
        id: c.id.substring(0, 10),
        score: c.totalPoints,
        praisesGiven: c.praisesGiven,
        praisesReceived: c.praisesReceived,
        blessings: c.blessingsGiven,
        maxDays: c.maxStakeDays,
      }))
    );
    console.log(`==========================================`);

    return NextResponse.json({
      curators: paginatedCurators,
      pagination: {
        first,
        skip,
        hasMore: skip + first < totalCurators,
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
