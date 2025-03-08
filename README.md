# GitHub Documentation Assistant

A Probot app that uses AI to provide documentation improvement suggestions in pull requests.

## Features

- Monitors pull request changes
- Automatically analyzes documentation in the code
- Uses AI to suggest improvements to comments and documentation
- Posts suggestions as review comments on the pull request

## Architecture

The application is organized into the following modules:

- **src/index.ts**: Main entry point that sets up event handlers
- **src/types**: Type definitions for the application
- **src/services**: Services for interacting with GitHub API
- **src/ai**: AI functionality for generating suggestions

## Installation

```bash
# Install dependencies
npm install

# Build the app
npm run build

# Start the app
npm start
```

## Development

```bash
# Run the app in development mode with auto-reloading
npm run dev

# Run tests
npm test
```

## Environment Variables

Create a `.env` file with the following variables:

```
# GitHub App credentials
APP_ID=
WEBHOOK_SECRET=
PRIVATE_KEY=

# OpenAI API key
OPENAI_API_KEY=
```

## How It Works

1. The app listens for pull request synchronize events and push events
2. For each change, it analyzes the files modified
3. When it finds documentation changes (comments, JSDoc, etc.), it sends them to an AI model
4. The AI suggests improvements to the documentation
5. The app posts these suggestions as review comments on the pull request

## License

ISC
