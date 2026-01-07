// x_test.ts
const BEARER = Deno.env.get("X_BEARER_TOKEN");
if (!BEARER) {
  throw new Error("Missing X_BEARER_TOKEN env variable");
}

const ROOT_TWEET_ID = "1871234567890123456"; // <-- erstat med rigtig ID

async function xFetch(url: string) {
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${BEARER}`,
    },
  });

  if (!res.ok) {
    throw new Error(`X API error ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function run() {
  // 1. Hent root-opslaget
  const rootUrl =
    `https://api.x.com/2/tweets/${ROOT_TWEET_ID}` +
    `?tweet.fields=created_at,public_metrics,conversation_id` +
    `&expansions=author_id` +
    `&user.fields=username,name`;

  const root = await xFetch(rootUrl);

  const conversationId = root.data.conversation_id;

  // 2. Hent replies (samme conversation_id, men ikke root)
  const repliesUrl =
    `https://api.x.com/2/tweets/search/recent` +
    `?query=conversation_id:${conversationId} -from:${root.includes.users[0].username}` +
    `&max_results=10` +
    `&tweet.fields=created_at,public_metrics,referenced_tweets` +
    `&expansions=author_id` +
    `&user.fields=username,name`;

  const replies = await xFetch(repliesUrl);

  // Tag kun 2 replies
  const firstTwoReplies = (replies.data ?? []).slice(0, 2);

  // 3. Byg et lille test-output
  const output = {
    root: {
      id: root.data.id,
      author: root.includes.users[0],
      text: root.data.text,
      created_at: root.data.created_at,
      metrics: root.data.public_metrics,
    },
    replies: firstTwoReplies.map((t: any) => {
      const user = replies.includes.users.find(
        (u: any) => u.id === t.author_id,
      );

      return {
        id: t.id,
        author: user,
        text: t.text,
        created_at: t.created_at,
        metrics: t.public_metrics,
        parent: t.referenced_tweets?.[0]?.id ?? null,
      };
    }),
  };

  console.log(JSON.stringify(output, null, 2));
}

run();
