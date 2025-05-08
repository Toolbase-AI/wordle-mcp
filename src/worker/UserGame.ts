import { Agent } from "agents";
import { DailyWord, GameState, UserCurrentGame } from "./types";
import Stripe from "stripe";

export class UserGame extends Agent<Env, GameState> {
  get stripe() {
    return new Stripe(this.env.STRIPE_SECRET_KEY);
  }

  async setInitialProps(user: GameState["user"]) {
    await this.env.DB.prepare(
      `
          INSERT INTO Users (user_id, username)
          VALUES (?, ?)
          ON CONFLICT(user_id) DO NOTHING
        `
    )
      .bind(user.userId, user.username)
      .run();

    this.setState({
      user,
    });
  }

  isInitialized() {
    return !!this.state?.user;
  }

  async setDisplayName(displayName: string | null) {
    await this.env.DB.prepare(
      `
          UPDATE Users SET username = ? WHERE user_id = ?
        `
    )
      .bind(displayName || "Anonymous", this.state.user.userId)
      .run();

    this.setState({
      ...this.state,
      user: {
        ...this.state.user,
        username: displayName || "Anonymous",
      },
    });
  }

  async setXHandle(xHandle: string | null) {
    await this.env.DB.prepare(
      `
          UPDATE Users SET x_handle = ? WHERE user_id = ?
        `
    )
      .bind(xHandle || null, this.state.user.userId)
      .run();

    this.setState({
      ...this.state,
      user: {
        ...this.state.user,
        xHandle: xHandle || undefined,
      },
    });
  }

  async guessWord(guess: string) {
    const { gameState, isNewGame } = await this.ensureGameExists({
      overrideWithNewGame: true,
    });

    if (isNewGame) {
      return `A new word and game has been started. You have 6 attempts to guess the word. Your current guess does not count towards the new game. You may submit a new guess for the new word.`;
    }

    if (gameState.status !== "active") {
      return `Today's game is already ${gameState.status}. Try again tomorrow.`;
    }

    guess = guess.toLowerCase();
    const targetWord = gameState.targetWord;

    // Process guess
    const feedback = this.evaluateGuess(guess, targetWord);
    const visualFeedback = this.generateVisualFeedback(feedback);

    // Update game state
    gameState.attempts.push({
      guess,
      feedback,
      visualFeedback,
    });

    // Check win/lose conditions
    if (guess === targetWord) {
      gameState.status = "won";
    } else if (gameState.attempts.length >= gameState.maxAttempts) {
      gameState.status = "lost";
    }

    // Prepare response
    const attemptNumber = gameState.attempts.length;
    let responseText = `Guess ${attemptNumber}/${
      gameState.maxAttempts
    }: ${guess.toUpperCase()}\n${visualFeedback}\n\n`;

    // Add game result if finished
    if (gameState.status === "won") {
      responseText += `Congratulations! You've guessed the word in ${attemptNumber} attempts.`;
    } else if (gameState.status === "lost") {
      responseText += `Game over! You have used all your attempts for today's word.`;
    }

    this.setState({
      ...this.state,
      game: gameState,
    });

    if (gameState.status !== "active") {
      // Won or lost, store stats.
      this.ctx.waitUntil(this.storeStats());
    }

    return responseText;
  }

  async getCurrentGame() {
    // @todo - maybe override game with this command?
    const { gameState, isNewGame } = await this.ensureGameExists({
      overrideWithNewGame: false,
    });

    if (isNewGame) {
      return `A new word and game has been started. You may make a new guess for the new word before getting your current game information.`;
    }

    const attemptsDisplay = gameState.attempts
      .map((a) => `${a.guess.toUpperCase()}: ${a.visualFeedback}`)
      .join("\n");

    return `Today's Challenge (${gameState.date})\nStatus: ${gameState.status}\nAttempts: ${gameState.attempts.length}/${gameState.maxAttempts}\n\n${attemptsDisplay}`;
  }

  async getHint() {
    const { gameState, isNewGame } = await this.ensureGameExists({
      overrideWithNewGame: false,
    });

    if (isNewGame) {
      return `A new word and game has been started. Your current request for a hint does not count towards the new game. You may make a new guess for the new word before requesting a hint.`;
    }

    if (gameState.status !== "active") {
      return `Game is already ${gameState.status}.`;
    }

    const { isPaid, checkoutUrl } = await this.requirePayment();

    if (!isPaid) {
      return `Please open this the following link to pay to receive a hint: ${checkoutUrl}. Show the link to the user.`;
    }

    const resp = await this.env.AI.run(
      "@cf/meta/llama-4-scout-17b-16e-instruct",
      {
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that provides hints for a Wordle game.
            Given a word from the user, provide a vague and non-specific hint about the word. 
            Don't give direct definitions of the word.
            This description should be helpful to the user but not specific enough to guess the word. 
            The hint must not be easy enough to help the LLM guess the word.
            The hint must not be offensive or vulgar.
            The hint must be a single setence.
            The hint must be about the words structure, not the meaning.
            The hint should talk about the number of vowels or the number of consonants or the number of unique letters or the number of letters that are repeated or the number of letters that are not repeated or the number of letters that are in the word or the number of letters that are not in the word or the number of letters that are in the word and the number of letters that are not in the word, or something similar.
            Only one hint should be given, as in the number of vowels and must not provide any other hint.
            Only respond with the hint itself, nothing else. No code or any sort of formatting.
            Hints should be unique and not similiar or related to each other.
            `,
          },
          ...gameState.hints.map((hint) => ({
            role: "assistant",
            content: hint,
          })),
          {
            role: "user",
            content: `Give me a unique hint for the word: ${gameState.targetWord}`,
          },
        ],
      }
    );

    // @ts-ignore
    const hint = resp.response.trim();

    gameState.hints.push(hint);

    this.setState({
      ...this.state,
      game: gameState,
    });

    this.ctx.waitUntil(this.resetPayment());

    return `Hint: ${hint}`;
  }

  async getLeaderboard() {
    const { results: topTenResults } = await this.env.DB.prepare(
      `
        SELECT
          u.user_id,
          u.username,
          u.x_handle,
          s.wins,
          s.losses,
          s.total_guesses,
          s.total_hints,
          RANK() OVER (
            ORDER BY s.wins DESC, s.total_guesses ASC
          ) AS rank
        FROM UserStats s
        JOIN Users u ON u.user_id = s.user_id
        ORDER BY rank
        LIMIT 10
      `
    ).all();

    const { results: userResults } = await this.env.DB.prepare(
      `
        SELECT * FROM (
          SELECT
            u.user_id,
            u.username,
            u.x_handle,
            s.wins,
            s.losses,
            s.total_guesses,
            s.total_hints,
            RANK() OVER (
              ORDER BY s.wins DESC, s.total_guesses ASC
            ) AS rank
          FROM UserStats s
          JOIN Users u ON u.user_id = s.user_id
        ) WHERE user_id = ?
      `
    )
      .bind(this.state.user.userId)
      .all();

    const topTen = topTenResults.map((row) => {
      const xLink =
        typeof row.x_handle === "string"
          ? this.getXHandleLink(row.x_handle)
          : null;

      return {
        xLink,
        rank: row.rank,
        username: row.username,
        twitterLink: xLink,
        wins: row.wins,
        totalGuesses: row.total_guesses,
        losses: row.losses,
      };
    });

    const user = userResults.map((row) => {
      const xLink =
        typeof row.x_handle === "string"
          ? this.getXHandleLink(row.x_handle)
          : null;

      return {
        xLink,
        rank: row.rank,
        username: row.username,
        twitterLink: xLink,
        wins: row.wins,
        totalGuesses: row.total_guesses,
        losses: row.losses,
      };
    })[0];

    const response = JSON.stringify({
      topTenUsers: !topTen?.length ? "No one is on the leaderboard" : topTen,
      currentUser: !user ? "You have not completed a game to be ranked " : user,
    });

    return response;
  }

  private getXHandleLink(xHandle: string) {
    return `https://x.com/${xHandle}`;
  }

  // Helper methods
  private async ensureGameExists({
    overrideWithNewGame = false,
  }): Promise<{ gameState: UserCurrentGame; isNewGame: boolean }> {
    let game = this.state.game;

    const dailyWords =
      (await this.env.WORDLE_KV.get<DailyWord[]>("daily_words", "json")) ?? [];

    const dailyWord = dailyWords[dailyWords.length - 1];

    if (!dailyWord) {
      throw new Error("No daily word found");
    }

    const isNewGame = !!game && game.gameId !== dailyWord.gameId;

    if (!game || (isNewGame && overrideWithNewGame)) {
      if (isNewGame && game) {
        // New game and old game exists, check to see if the game is still in progress, if so, store to database they lost.
        // We are only here if override is true as well.
        if (game.status === "active") {
          // In progress, its a loss.
          this.ctx.waitUntil(this.storeStats());
        }
      }

      game = {
        gameId: dailyWord.gameId,
        date: dailyWord.date,
        targetWord: dailyWord.word,
        attempts: [],
        maxAttempts: 6,
        status: "active",
        hints: [],
      };

      this.setState({
        ...this.state,
        game,
      });
    }

    return { gameState: game, isNewGame };
  }

  private evaluateGuess(
    guess: string,
    target: string
  ): Array<"correct" | "present" | "absent"> {
    const result: Array<"correct" | "present" | "absent"> =
      Array(5).fill("absent");
    const targetChars: Array<string | null> = target.split("");

    // First pass: find correct positions
    for (let i = 0; i < 5; i++) {
      if (guess[i] === target[i]) {
        result[i] = "correct";
        targetChars[i] = null; // Mark as used
      }
    }

    // Second pass: find present but incorrect positions
    for (let i = 0; i < 5; i++) {
      if (result[i] === "absent") {
        const targetIndex = targetChars.indexOf(guess[i]);
        if (targetIndex !== -1) {
          result[i] = "present";
          targetChars[targetIndex] = null; // Mark as used
        }
      }
    }

    return result;
  }

  private generateVisualFeedback(
    feedback: Array<"correct" | "present" | "absent">
  ): string {
    return feedback
      .map((f) => {
        if (f === "correct") return "🟩";
        if (f === "present") return "🟨";
        return "⬜";
      })
      .join("");
  }

  private async storeStats() {
    const game = this.state.game;

    if (!game) {
      throw new Error("No game found");
    }

    // No attempts made, so don't default to losing.
    if (game.attempts.length === 0) {
      return;
    }

    const isWon = game.status === "won";

    this.ctx.waitUntil(
      this.env.DB.prepare(
        `
        INSERT INTO UserStats (user_id, wins, losses, total_hints, total_guesses)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          wins = UserStats.wins + ?,
          losses = UserStats.losses + ?,
          total_hints = UserStats.total_hints + ?,
          total_guesses = UserStats.total_guesses + ?
      `
      )
        .bind(
          this.state.user.userId,
          isWon ? 1 : 0,
          isWon ? 0 : 1,
          game.hints.length,
          game.attempts.length,
          // For the update (increments)
          isWon ? 1 : 0,
          isWon ? 0 : 1,
          game.hints.length,
          game.attempts.length
        )
        .run()
    );
  }

  private async requirePayment() {
    if (!this.state) {
      throw new Error("No state found");
    }

    const { customerId, currentHintCheckoutSession } = this.state.stripe ?? {
      customerId: await this.getCurrentCustomerID(this.state.user.email),
    };

    if (currentHintCheckoutSession) {
      const session = await this.stripe.checkout.sessions.retrieve(
        currentHintCheckoutSession
      );

      if (session.payment_status === "paid") {
        return { isPaid: true, checkoutUrl: undefined };
      }
    }

    // Hasn't paid, so we need to create a checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      success_url: this.env.HINT_SUCCESS_URL,
      line_items: [{ price: this.env.HINT_PRICE_ID, quantity: 1 }],
    });

    this.setState({
      ...this.state,
      stripe: {
        customerId,
        currentHintCheckoutSession: session.id,
      },
    });

    return { isPaid: false, checkoutUrl: session.url };
  }

  private async resetPayment() {
    if (!this.state) {
      throw new Error("No state found");
    }

    const customerId =
      this.state.stripe?.customerId ??
      (await this.getCurrentCustomerID(this.state.user.email));

    this.setState({
      ...this.state,
      stripe: {
        customerId,
        currentHintCheckoutSession: undefined,
      },
    });
  }

  private async getCurrentCustomerID(userEmail: string) {
    if (this.state?.stripe?.customerId) {
      return this.state.stripe.customerId;
    }

    const customers = await this.stripe.customers.list({
      email: userEmail,
    });

    const customerId = customers.data.find((customer) => {
      return customer.email === userEmail;
    })?.id;

    if (customerId) {
      return customerId;
    }

    const customer = await this.stripe.customers.create({
      email: userEmail,
    });

    return customer.id;
  }
}
