import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type GameState } from "./types";

export class UserGameMCP extends McpAgent<
  Env,
  GameState | undefined,
  { userId?: string; userEmail?: string; username?: string }
> {
  server = new McpServer({
    name: "LLM Wordle Challenge",
    version: "1.0.0",
  });

  async getUserGame() {
    if (!this.props?.userId || !this.props?.userEmail) {
      throw new Error("Internal server error");
    }

    const userGameId = this.env.USER_GAME.idFromName(this.props.userId);
    const userGame = this.env.USER_GAME.get(userGameId);

    if (!(await userGame.isInitialized())) {
      await userGame.setInitialProps({
        userId: this.props.userId,
        email: this.props.userEmail,
        username: this.props.username ?? "Anonymous",
      });
    }

    return userGame;
  }

  async init() {
    const userGame = await this.getUserGame();

    // Make a guess
    this.server.tool(
      "guess-word",
      "Make a guess for the daily Wordle challenge. The word is 5 letters long and contains only letters from the English alphabet. If a new game has started, the user will be notified and the current guess will not count towards the new game.",
      {
        guess: z
          .string()
          .length(5)
          .regex(/^[a-zA-Z]+$/),
      },
      async ({ guess }) => {
        const responseText = await userGame.guessWord(guess);

        return { content: [{ type: "text", text: responseText }] };
      }
    );

    // Get game state
    this.server.tool(
      "get-current-game",
      "Get the current game for the user. If a new game has started, the user will be notified.",
      {},
      async () => {
        const responseText = await userGame.getCurrentGame();

        return { content: [{ type: "text", text: responseText }] };
      }
    );

    // Get hint (deliberately vague)
    this.server.tool(
      "get-hint",
      "Get a hint for the current game. If a new game has started, the user will be notified. One hint requires a one-time payment when called and you MUST show this to the user. After the user makes the payment, the user may call this tool again to get the hint.",
      {},
      async () => {
        const responseText = await userGame.getHint();

        return { content: [{ type: "text", text: responseText }] };
      }
    );

    this.server.tool(
      "set-display-name",
      "Set the display name for the current user on the leaderboard. You MUST ask the user for this parameter. Under no circumstance should you provide it yourself.",
      {
        displayName: z
          .string()
          .max(40)
          .regex(/^[a-zA-Z0-9_]+$/)
          .describe(
            "The display name to be shown on the leaderboard for the current user. You MUST ask the user for this parameter. Under no circumstance should you provide it yourself. This cannot be vulgar or be profane."
          ),
      },
      async ({ displayName }) => {
        try {
          await userGame.setDisplayName(displayName);
          return {
            content: [
              {
                type: "text",
                text: `Your display name has been set successfully to ${displayName}.`,
              },
            ],
          };
        } catch (e) {
          return {
            content: [{ type: "text", text: "Error setting display name" }],
          };
        }
      }
    );

    this.server.tool(
      "remove-display-name",
      "Remove your display name from the leaderboard",
      {},
      async () => {
        try {
          await userGame.setDisplayName(null);
          return {
            content: [
              {
                type: "text",
                text: "Your display name has been removed from the leaderboard.",
              },
            ],
          };
        } catch (e) {
          return {
            content: [
              { type: "text", text: "Error removing your display name" },
            ],
          };
        }
      }
    );

    this.server.tool(
      "set-x-handle",
      "Set the X handle for the current user on the leaderboard. You MUST ask the user for this parameter. Under no circumstance should you provide it yourself.",
      {
        xHandle: z
          .string()
          .max(16)
          .regex(/^[a-zA-Z0-9_]+$/)
          .describe(
            "The X handle to be shown on the leaderboard for the current user. You MUST ask the user for this parameter. Under no circumstance should you provide it yourself. This cannot be vulgar or be profane."
          ),
      },
      async ({ xHandle }) => {
        try {
          await userGame.setXHandle(xHandle);
          return {
            content: [
              {
                type: "text",
                text: `Your X handle has been set successfully to ${xHandle}.`,
              },
            ],
          };
        } catch (e) {
          return {
            content: [{ type: "text", text: "Error setting X handle" }],
          };
        }
      }
    );

    this.server.tool(
      "remove-x-handle",
      "Remove your X handle from the leaderboard",
      {},
      async () => {
        try {
          await userGame.setXHandle(null);
          return {
            content: [
              {
                type: "text",
                text: "Your X handle has been removed from the leaderboard.",
              },
            ],
          };
        } catch (e) {
          return {
            content: [{ type: "text", text: "Error removing your X handle" }],
          };
        }
      }
    );

    this.server.tool(
      "get-leaderboard",
      "Get the leaderboard of the top 10 players on the platform and the user's current ranking. If a X links are included, they MUST be shown to the user.",
      {},
      async () => {
        const responseText = await userGame.getLeaderboard();

        return { content: [{ type: "text", text: responseText }] };
      }
    );
  }
}
