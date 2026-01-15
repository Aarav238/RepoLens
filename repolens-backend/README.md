# RepoLens Backend

Backend service for analyzing GitHub repositories and generating Intermediate Representation (IR).

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- GitHub Personal Access Token

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Add your GitHub token, OpenAI API key, and configure logging in `.env`:
```
GITHUB_TOKEN=ghp_your_token_here
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL=gpt-4o-mini
PORT=3000
LOG_LEVEL=debug
NODE_ENV=development
```

**Environment Variables:**
- `GITHUB_TOKEN` - GitHub Personal Access Token (required)
- `OPENAI_API_KEY` - OpenAI API key for LLM reasoning (required for Phase 7.3+)
- `OPENAI_MODEL` - OpenAI model to use (default: gpt-4o-mini)
- `PORT` - Server port (default: 3000)
- `LOG_LEVEL` - Logging level: error, warn, info, debug (default: debug in dev, info in prod)
- `NODE_ENV` - Environment: development or production (default: development)

### Development

Run the development server with hot reload:
```bash
npm run dev
```

### Build

Build TypeScript to JavaScript:
```bash
npm run build
```

### Production

Run the production server:
```bash
npm start
```

## 📁 Project Structure

```
src/
├── server.ts                 # Express server setup
├── api/
│   └── analyze.controller.ts # API endpoint controller
├── github/
│   └── repoFetcher.ts        # GitHub repo fetching logic
├── scanner/
│   ├── entry.scanner.ts      # Entry point detection
│   ├── call.scanner.ts       # Method call detection
│   ├── event.scanner.ts      # Event detection
│   ├── external.scanner.ts   # External system detection
│   ├── structure.scanner.ts  # Code structure detection
│   └── types.ts              # Signal type definitions
├── ir/
│   ├── ir.types.ts           # IR schema definitions
│   ├── ir.builder.ts         # IR construction logic
│   ├── flowContext.types.ts  # FlowContext type definitions
│   ├── flowContextBuilder.ts # FlowContext builder (Phase 7.1)
│   └── flowEnricher.ts       # Flow enrichment with LLM (Phase 7.5)
├── llm/
│   ├── prompts.ts            # LLM prompt definitions (Phase 7.2)
│   ├── client.ts             # Raw LLM client (Phase 7.3)
│   ├── flowReasoner.ts       # Flow reasoning adapter (Phase 7.3)
│   ├── flowOutput.types.ts   # Output schema types (Phase 7.2/7.4)
│   ├── flowOutputValidator.ts # Output validation (Phase 7.4)
│   └── index.ts              # Module exports
└── utils/
    ├── fileFilter.ts         # File filtering utility
    └── logger.ts             # Winston logger configuration
```

## 🧱 Development Phases

- ✅ **Phase 1**: Backend skeleton (COMPLETE)
- ✅ **Phase 2**: GitHub repo ingestion (COMPLETE)
- ✅ **Phase 3**: Signal extraction (COMPLETE)
- ✅ **Phase 4**: Signal aggregation (COMPLETE)
- ✅ **Phase 5**: IR construction (COMPLETE)
- ✅ **Phase 5.5**: Critical fixes (COMPLETE)
- ✅ **Phase 5.6**: Flow linking (COMPLETE)
- ✅ **Phase 5.7**: Handler indexing (COMPLETE)
- ✅ **Phase 6**: API response (COMPLETE)
- ✅ **Phase 7.1**: FlowContext builder (COMPLETE)
- ✅ **Phase 7.2**: Prompt & output contract (COMPLETE)
- ✅ **Phase 7.3**: LLM invocation layer (COMPLETE)
- ✅ **Phase 7.4**: Output validation (COMPLETE)
- ✅ **Phase 7.5**: IR enrichment (COMPLETE)

## 📡 API Endpoints

### POST /analyze-repo

Analyzes a GitHub repository and returns the IR.

**Request Body:**
```json
{
  "owner": "octocat",
  "repo": "Hello-World",
  "branch": "main"
}
```

**Response:**
```json
{
  "meta": {...},
  "services": [...],
  "entryPoints": [...],
  "events": [...],
  "externals": [...],
  "flows": [...]
}
```

### GET /health

Health check endpoint.

## 📊 Logging

The application uses Winston for structured logging. Logs are written to:

- **Console**: All logs (formatted for readability in development)
- **logs/combined.log**: All logs in JSON format
- **logs/error.log**: Only error-level logs
- **logs/exceptions.log**: Unhandled exceptions
- **logs/rejections.log**: Unhandled promise rejections

### Log Levels

- `error`: Error events that might still allow the app to continue
- `warn`: Warning messages
- `info`: Informational messages (default in production)
- `debug`: Debug messages (default in development)

### Logging Features

- **Request Logging**: All HTTP requests are automatically logged with method, path, status code, and duration
- **Phase Logging**: Development phases are logged with `logPhase()` helper
- **Signal Logging**: Signal extraction is logged with `logSignal()` helper
- **Error Logging**: Errors are logged with full stack traces and context

### Example Log Output

```
2024-01-15 10:30:45 [info]: 🚀 RepoLens Backend running on http://localhost:3000
2024-01-15 10:30:50 [info]: HTTP Request {"method":"POST","path":"/analyze-repo","statusCode":200,"duration":"150ms"}
2024-01-15 10:30:50 [info]: [Phase 1] Starting repository analysis {"owner":"octocat","repo":"Hello-World"}
```

## 📝 License

ISC
