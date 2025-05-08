import { UserGameMCP } from "./UserGameMCP";
import { UserGame } from "./UserGame";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { DailyWord } from "./types.js";
import { v4 as uuidv4 } from "uuid";
import { createMiddleware } from "hono/factory";

interface ClerkCreateClient {
  object: string;
  id: string;
  instance_id: string;
  name: string;
  client_id: string;
  public: boolean;
  scopes: string;
  redirect_uris: string[];
  callback_url: string;
  authorize_url: string;
  token_fetch_url: string;
  user_info_url: string;
  discovery_url: string;
  token_introspection_url: string;
  created_at: number;
  updated_at: number;
  client_secret?: string;
}

// Export the TodoMCP class so the Worker runtime can find it
export { UserGameMCP, UserGame };

const validateStringField = (field: any): string | undefined => {
  if (field === undefined) {
    return undefined;
  }
  if (typeof field !== "string") {
    throw new Error("Field must be a string");
  }
  return field;
};

const validateStringArray = (arr: any): string[] | undefined => {
  if (arr === undefined) {
    return undefined;
  }
  if (!Array.isArray(arr)) {
    throw new Error("Field must be an array");
  }

  // Validate all elements are strings
  for (const item of arr) {
    if (typeof item !== "string") {
      throw new Error("All array elements must be strings");
    }
  }

  return arr;
};

/**
 * Creates an array of length `size` of random bytes
 * @param size
 * @returns Array of random ints (0 to 255)
 */
async function getRandomValues(size: number) {
  return crypto.getRandomValues(new Uint8Array(size));
}

/** Generate cryptographically strong random string
 * @param size The desired length of the string
 * @returns The random string
 */
async function random(size: number) {
  const mask =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
  let result = "";
  const randomUints = await getRandomValues(size);
  for (let i = 0; i < size; i++) {
    // cap the value of the randomIndex to mask.length - 1
    const randomIndex = randomUints[i] % mask.length;
    result += mask[randomIndex];
  }
  return result;
}

const clerkAuthMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json(
        {
          error: "Unauthorized",
        },
        401
      );
    }

    // Extract token
    const accessToken = authHeader.slice(7);

    const userResponse = await fetch(
      `${c.env.CLERK_INSTANCE_URL}/oauth/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!userResponse.ok) {
      return c.json(
        {
          error: "Unauthorized",
        },
        401
      );
    }

    const user = (await userResponse.json()) as {
      [x: string]: any;
      user_id: string;
    };

    if (!user.user_id) {
      return c.json(
        {
          error: "Unauthorized",
        },
        401
      );
    }
    // @ts-ignore
    c.executionCtx.props = {
      userId: user.user_id,
      userEmail: user.email,
      username: user.preferred_username,
    };

    return next();
  }
);

const app = new Hono<{ Bindings: Env }>()
  .use(cors())

  // Serve the OAuth Authorization Server response for Dynamic Client Registration
  .get("/.well-known/oauth-authorization-server", async (c) => {
    const url = new URL(c.req.url);
    return c.json({
      issuer: c.env.CLERK_INSTANCE_URL,
      // Link to the OAuth Authorization screen implemented within the React UI
      authorization_endpoint: `${url.origin}/oauth/authorize`,
      token_endpoint: `${c.env.CLERK_INSTANCE_URL}/oauth/token`,
      registration_endpoint: `${url.origin}/oauth/register`,
      scopes_supported: ["profile", "email"],
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "none",
      ],
      code_challenge_methods_supported: ["S256"],
    });
  })

  .get("/oauth/authorize", async (c) => {
    const url = new URL(c.req.url);

    const params = url.searchParams;

    if (!params.has("state")) {
      params.set("state", await random(32));
    }

    const redirectUrl = new URL(
      `${c.env.CLERK_INSTANCE_URL}/oauth/authorize?${params.toString()}`
    );

    return c.redirect(redirectUrl.toString());
  })

  .post("/oauth/register", async (c) => {
    const url = new URL(c.req.url);

    // Check content length to ensure it's not too large (1 MiB limit)
    const contentLength = Number.parseInt(
      c.req.header("Content-Length") || "0",
      10
    );
    if (contentLength > 1048576) {
      // 1 MiB = 1048576 bytes
      return c.json(
        {
          error: "invalid_request",
          error_description: "Request payload too large, must be under 1 MiB",
        },
        413
      );
    }

    // Parse client metadata with a size limitation
    let clientMetadata: {
      redirect_uris: string[];
      client_name?: string;
      scopesSupported?: string[];
      token_endpoint_auth_method?: string;
    };
    try {
      const text = await c.req.text();
      if (text.length > 1048576) {
        // Double-check text length
        return c.json(
          {
            error: "invalid_request",
            error_description: "Request payload too large, must be under 1 MiB",
          },
          413
        );
      }
      clientMetadata = JSON.parse(text);
    } catch (error) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "Invalid JSON payload",
        },
        400
      );
    }

    // Get token endpoint auth method, default to client_secret_basic
    const authMethod =
      validateStringField(clientMetadata.token_endpoint_auth_method) ||
      "client_secret_basic";
    const isPublicClient = authMethod === "none";

    let clientBody: {
      redirect_uris: string[];
      name?: string;
      scopes: string;
      public: boolean;
    };

    try {
      // Validate redirect URIs - must exist and have at least one entry
      const redirectUris = validateStringArray(clientMetadata.redirect_uris);

      if (!redirectUris || redirectUris.length === 0) {
        throw new Error("At least one redirect URI is required");
      }

      clientBody = {
        redirect_uris: redirectUris,
        name: validateStringField(clientMetadata.client_name),
        scopes: clientMetadata.scopesSupported?.join(" ") ?? "",
        public: isPublicClient,
      };
    } catch (error) {
      return c.json(
        {
          error: "invalid_client_metadata",
          error_description:
            error instanceof Error ? error.message : "Invalid client metadata",
        },
        400
      );
    }

    // Create client on Clerk
    const createClientResp = await fetch(
      `${c.env.CLERK_BACKEND_URL}/oauth_applications`,
      {
        method: "POST",
        body: JSON.stringify(clientBody),
        headers: {
          Authorization: `Bearer ${c.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!createClientResp.ok) {
      return c.json(
        {
          error: "invalid_client_metadata",
        },
        400
      );
    }

    const createClientBody =
      (await createClientResp.json()) as ClerkCreateClient;

    // Return client information with the original unhashed secret
    const response: Record<string, any> = {
      client_id: createClientBody.client_id,
      redirect_uris: createClientBody.redirect_uris,
      client_name: createClientBody.name,
      logo_uri: "",
      client_uri: "",
      policy_uri: "",
      tos_uri: "",
      jwks_uri: "",
      contacts: [],
      grant_types: [],
      response_types: [],
      token_endpoint_auth_method: authMethod,
      registration_client_uri: `${url.origin}/oauth/register/${createClientBody.client_id}`,
      client_id_issued_at: createClientBody.created_at,
    };

    if (
      !isPublicClient &&
      !createClientBody.public &&
      !!createClientBody.client_secret
    ) {
      response.client_secret = createClientBody.client_secret;
    }

    return c.json(response, 201);
  })

  .use("/sse/*", clerkAuthMiddleware)
  // SSE
  .route(
    "/sse",
    new Hono().mount("/", (c, env, executionCtx) => {
      return UserGameMCP.serveSSE("/sse").fetch(c, env, executionCtx);
    })
  )
  // Streaming
  .use("/mcp/*", clerkAuthMiddleware)
  .route(
    "/mcp",
    new Hono().mount("/", (c, env, executionCtx) => {
      return UserGameMCP.serve("/mcp").fetch(c, env, executionCtx);
    })
  )

  .mount("/", (req, env) => env.ASSETS.fetch(req));

export default {
  fetch: app.fetch,
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ) {
    // Generate new daily word
    const today = new Date().toISOString().split("T")[0];

    // Get the Daily Words
    const dailyWords =
      (await env.WORDLE_KV.get<DailyWord[]>("daily_words", "json")) ?? [];

    const wordHistory = dailyWords.map((w) => w.word);

    // Generate word with AI
    let newWord = "";
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const resp = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that generates 5-letter words for a Wordle game. 
              The word must be uncommon, possibly technical, or have unusual letter patterns. The word must be hard to guess even by an LLM. It must be exactly 5 letters, contain only alphabetic characters, and be a real English word.
              The word must not be offensive or vulgar. The word must be in the dictionary. Only respond with the word itself in lowercase, nothing else. No code or any sort of formatting. The word should not be in the following list: ${wordHistory.join(
                ", "
              )}`,
          },
          {
            role: "user",
            content: "Generate a word",
          },
        ],
      });

      // Clean up response
      // @ts-ignore
      const candidateWord = resp.response.trim().toLowerCase();

      // Validate word (5 letters, alphabetic, not previously used)
      if (
        candidateWord.length === 5 &&
        /^[a-z]+$/.test(candidateWord) &&
        !wordHistory.includes(candidateWord)
      ) {
        newWord = candidateWord;
        break;
      }

      attempts++;
    }

    if (!newWord) {
      throw new Error("Failed to generate a new word");
    }

    const gameId = uuidv4();
    dailyWords.push({ gameId, date: today, word: newWord });

    await env.WORDLE_KV.put("daily_words", JSON.stringify(dailyWords));

    console.log(`New word set for ${gameId} (${today}): ${newWord}`);
    return new Response("Daily word updated", { status: 200 });
  },
};
