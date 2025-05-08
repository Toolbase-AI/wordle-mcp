CREATE TABLE IF NOT EXISTS UserStats (
  user_id TEXT PRIMARY KEY,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  total_hints INTEGER NOT NULL DEFAULT 0,
  total_guesses INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES Users(user_id)
);

CREATE TABLE IF NOT EXISTS Users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  x_handle TEXT -- can be NULL if not provided
);