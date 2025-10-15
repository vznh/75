# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"kept" is a Discord challenge bot for tracking 75-day challenges with goal accountability. Users create daily entries, submit goals, and track progress through private Discord threads.

## Development Commands

```bash
# Install dependencies
bun install

# Run the bot in development
bun run dev
# OR
tsx src/index.ts

# Type checking (manual - no script defined)
tsc --noEmit
```

## Architecture

### Core Components

**Entry Point**: `src/index.ts`
- Discord bot initialization with comprehensive error handling
- Event handlers for interactions, messages, and reactions
- Graceful shutdown management
- Command registration (`/signup`)

**Service Layer**: `src/lib/entry.ts` (EntryService class)
- Thread creation and management
- Submission validation per goal type
- Real-time status updates via message editing
- Automated reminder system
- Entry archiving and sharing

**Goal System**: `src/lib/goals.ts`
- Defines daily/weekly goals with validation logic
- Role-based goal assignment
- Goal requirement checking

**UI Layer**: `src/func/bot.ts`
- Discord embed creation and button interactions
- User interface components

**Types**: `src/types/index.ts`
- Comprehensive TypeScript interfaces for users, entries, submissions, goals

### Key Features

- **Thread-based entries**: Private threads for each user's daily submissions
- **Goal types**: LeetCode, Water, Sleep, Cardio, Food, Job Applications, Exercise, DJ, Reading, Late Eating (daily); Cafe visits, Portfolio work, Internship work (weekly)
- **Accountability**: Real-time status displays showing completion rates
- **Reminders**: Automated notifications at 11:00 PM and 11:30 PM PDT
- **Entry sharing**: Users can share completed entries to main channel

### Data Management

- Currently uses in-memory session tracking (no database dependency)
- Discord thread-based persistence
- Environment variables for configuration (Discord tokens, channel IDs)
- Planned Supabase integration

### Channel Configuration

Hardcoded channel IDs in environment:
- Status channel: `1424172599197565109`
- Archive channel: `1424342473198796961` 
- Main channel: `1424567137976188960`
- Role selection: `1424177763895607380`
- Share channel: `1425381486395260980`

## Development Guidelines

Follow existing patterns from CURSOR.md:
- Concise code without over-explanation
- Atomic design patterns
- Strong TypeScript typing
- Comprehensive error handling
- Avoid wrapper functions for simple operations
- Use Zustand for state management if needed
- Experimental React hooks allowed for future UI components

## Entry Flow

1. User creates entry via button or `!entry` command
2. Bot creates private thread in archive channel
3. Thread contains goal embeds for each user
4. Users reply to embeds with submissions
5. Bot validates submissions based on goal requirements
6. Thread archives when complete, status updates automatically
7. Users can share completed entries

## Testing

No test framework currently configured. Jest recommended for future test implementation with intent-based testing.