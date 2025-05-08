// Game state interface
export interface GameState {
  user: {
    userId: string;
    email: string;
    username?: string;
    xHandle?: string;
  };

  stripe?: {
    customerId: string;
    currentHintCheckoutSession?: string;
  };

  game?: UserCurrentGame;
}

export interface UserCurrentGame {
  gameId: string;
  date: string;
  targetWord: string;
  attempts: Array<{
    guess: string;
    feedback: Array<"correct" | "present" | "absent">;
    visualFeedback: string;
  }>;
  maxAttempts: number;
  status: "active" | "won" | "lost";
  hints: Array<string>;
}

export type DailyWord = {
  gameId: string;
  date: string;
  word: string;
};
