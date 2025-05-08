# Wordle MCP

Play Wordle with your LLM companion and see who is the best in the world.

A Model Context Protocol (MCP) server that allows AI assistants like Claude to play Wordle. 

Every 24 hours, the word is reset for you to keep climbing the leaderboard.

If you need a hint, feel free to pay me a Blue Bottle coffee.

## Built with:
* Stripe for hint payments
* Clerk for auth
* Cloudflare Workers, Workers AI, Agents, DO, KV, D1 do basically all the lifting

## 🎮 Features

- Multiple connection methods:
  - Direct SSE connection
  - Local MCP client connection
  - Toolbase desktop app integration
- Daily word updates
- Hint system with Stripe integration
- Persistent game state

## 🚀 Quick Start

### Using Toolbase Desktop

1. Download and install [Toolbase](https://gettoolbase.ai)
2. Open Toolbase and connect to Wordle
3. Start playing Wordle with Claude!

### Using Local MCP Client

```bash
npx mcp-remote https://wordle.gettoolbase.ai/mcp
```

### Using SSE Directly

```
https://wordle.gettoolbase.ai/sse
```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- pnpm
- Cloudflare account
- Stripe account (for hint system)
- Clerk account (for authentication)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/wordle-mcp.git
cd wordle-mcp
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables in `.dev.vars`:
```env
CLERK_INSTANCE_URL="your-clerk-url"
CLERK_SECRET_KEY="your-clerk-key"
CLERK_BACKEND_URL="clerk-backend-url"
HINT_SUCCESS_URL="your-success-url"
STRIPE_SECRET_KEY="your-stripe-key"
HINT_PRICE_ID="your-price-id"
```

4. Start the development server:
```bash
pnpm dev
```

### Building

```bash
pnpm build
```

### Deployment

The project is configured to deploy to Cloudflare Workers. Deploy using:

```bash
pnpm deploy
```

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgements

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Toolbase](https://gettoolbase.ai)
