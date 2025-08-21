exports = async function () {
  const mongodb = context.services.get("Cluster1")
  if (!mongodb) throw new Error("Could not access MongoDB cluster")

  const db = mongodb.db("eden-prod")
  if (!db) throw new Error("Could not access database eden-prod")

  const agentCollection = db.collection("users3")
  const threadCollection = db.collection("threads3")

  const agentStats = await threadCollection.aggregate([
    {
      $match: {
        updatedAt: { $exists: true }
      }
    },
    {
      $facet: {
        allTime: [
          // Unwind messages immediately to avoid storing them
          { $unwind: "$messages" },
          {
            $group: {
              _id: "$agent",
              threadCount: { $addToSet: "$_id" },
              users: { $addToSet: "$user" },
              userMessages: {
                $sum: {
                  $cond: [
                    { $eq: ["$messages.role", "user"] },
                    1,
                    0
                  ]
                }
              },
              assistantMessages: {
                $sum: {
                  $cond: [
                    { $eq: ["$messages.role", "assistant"] },
                    1,
                    0
                  ]
                }
              },
              toolCallCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$messages.role", "assistant"] },
                        { $isArray: "$messages.tool_calls" }
                      ]
                    },
                    { $size: { $ifNull: ["$messages.tool_calls", []] } },
                    0
                  ]
                }
              }
            }
          },
          {
            $project: {
              threadCount: { $size: "$threadCount" },
              userMessageCount: "$userMessages",
              assistantMessageCount: "$assistantMessages",
              toolCallCount: 1,
              userCount: {
                $size: {
                  $filter: {
                    input: "$users",
                    as: "user",
                    cond: { $ne: ["$$user", null] }
                  }
                }
              }
            }
          }
        ],
        last7Days: [
          {
            $match: {
              updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }
          },
          // Unwind messages immediately to avoid storing them
          { $unwind: "$messages" },
          {
            $group: {
              _id: "$agent",
              threadCount: { $addToSet: "$_id" },
              users: { $addToSet: "$user" },
              userMessages: {
                $sum: {
                  $cond: [
                    { $eq: ["$messages.role", "user"] },
                    1,
                    0
                  ]
                }
              },
              assistantMessages: {
                $sum: {
                  $cond: [
                    { $eq: ["$messages.role", "assistant"] },
                    1,
                    0
                  ]
                }
              },
              toolCallCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$messages.role", "assistant"] },
                        { $isArray: "$messages.tool_calls" }
                      ]
                    },
                    { $size: { $ifNull: ["$messages.tool_calls", []] } },
                    0
                  ]
                }
              }
            }
          },
          {
            $project: {
              threadCount: { $size: "$threadCount" },
              userMessageCount: "$userMessages",
              assistantMessageCount: "$assistantMessages",
              toolCallCount: 1,
              userCount: {
                $size: {
                  $filter: {
                    input: "$users",
                    as: "user",
                    cond: { $ne: ["$$user", null] }
                  }
                }
              }
            }
          }
        ]
      }
    },
    {
      $project: {
        combined: {
          $map: {
            input: "$allTime",
            as: "allTimeStats",
            in: {
              _id: "$$allTimeStats._id",
              threadCount: "$$allTimeStats.threadCount",
              userMessageCount: "$$allTimeStats.userMessageCount",
              assistantMessageCount: "$$allTimeStats.assistantMessageCount",
              toolCallCount: "$$allTimeStats.toolCallCount",
              userCount: "$$allTimeStats.userCount",
              threadCount_7d: {
                $ifNull: [
                  {
                    $let: {
                      vars: {
                        matchedDoc: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$last7Days",
                                as: "recent",
                                cond: { $eq: ["$$recent._id", "$$allTimeStats._id"] }
                              }
                            },
                            0
                          ]
                        }
                      },
                      in: "$$matchedDoc.threadCount"
                    }
                  },
                  0
                ]
              },
              userMessageCount_7d: {
                $ifNull: [
                  {
                    $let: {
                      vars: {
                        matchedDoc: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$last7Days",
                                as: "recent",
                                cond: { $eq: ["$$recent._id", "$$allTimeStats._id"] }
                              }
                            },
                            0
                          ]
                        }
                      },
                      in: "$$matchedDoc.userMessageCount"
                    }
                  },
                  0
                ]
              },
              assistantMessageCount_7d: {
                $ifNull: [
                  {
                    $let: {
                      vars: {
                        matchedDoc: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$last7Days",
                                as: "recent",
                                cond: { $eq: ["$$recent._id", "$$allTimeStats._id"] }
                              }
                            },
                            0
                          ]
                        }
                      },
                      in: "$$matchedDoc.assistantMessageCount"
                    }
                  },
                  0
                ]
              },
              toolCallCount_7d: {
                $ifNull: [
                  {
                    $let: {
                      vars: {
                        matchedDoc: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$last7Days",
                                as: "recent",
                                cond: { $eq: ["$$recent._id", "$$allTimeStats._id"] }
                              }
                            },
                            0
                          ]
                        }
                      },
                      in: "$$matchedDoc.toolCallCount"
                    }
                  },
                  0
                ]
              },
              userCount_7d: {
                $ifNull: [
                  {
                    $let: {
                      vars: {
                        matchedDoc: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$last7Days",
                                as: "recent",
                                cond: { $eq: ["$$recent._id", "$$allTimeStats._id"] }
                              }
                            },
                            0
                          ]
                        }
                      },
                      in: "$$matchedDoc.userCount"
                    }
                  },
                  0
                ]
              }
            }
          }
        }
      }
    },
    { $unwind: "$combined" },
    { $replaceRoot: { newRoot: "$combined" } }
  ]).toArray()

  // Rest of the function remains the same
  for (const stat of agentStats) {
    if (!stat._id) continue

    await agentCollection.updateOne(
      { _id: stat._id },
      {
        $set: {
          'stats.userCount': stat.userCount,
          'stats.userCount_7d': stat.userCount_7d,
          'stats.threadCount': stat.threadCount,
          'stats.threadCount_7d': stat.threadCount_7d,
          'stats.userMessageCount': stat.userMessageCount,
          'stats.userMessageCount_7d': stat.userMessageCount_7d,
          'stats.assistantMessageCount': stat.assistantMessageCount,
          'stats.assistantMessageCount_7d': stat.assistantMessageCount_7d,
          'stats.toolCallCount': stat.toolCallCount,
          'stats.toolCallCount_7d': stat.toolCallCount_7d,
          'stats.lastUpdated': new Date()
        }
      }
    )
  }

  await agentCollection.updateMany(
    { stats: { $exists: false } },
    {
      $set: {
        stats: {
          userCount: 0,
          userCount_7d: 0,
          threadCount: 0,
          threadCount_7d: 0,
          userMessageCount: 0,
          userMessageCount_7d: 0,
          assistantMessageCount: 0,
          assistantMessageCount_7d: 0,
          toolCallCount: 0,
          toolCallCount_7d: 0,
          lastUpdated: new Date()
        }
      }
    }
  )

  console.log(`Updated statistics for ${agentStats.length} agents at ${new Date().toISOString()}`)

  return {
    agents_with_stats: agentStats.length,
  }
}