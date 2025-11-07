# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Turborepo monorepo using Bun as the package manager. The project has been migrated to use Biome for linting/formatting and Tailwind CSS v4. The UI components are based on shadcn/ui with the "new-york" style.

## Architecture

### Monorepo Structure

- **apps/web**: Next.js 16 application (main web app)
- **packages/ui**: Shared React component library (`@kianax/ui`) based on shadcn/ui
- **packages/typescript-config**: Shared TypeScript configurations

### UI Package Architecture

The `@kianax/ui` package is a component library with specific export patterns:

```
exports:
  "./globals.css" → src/styles/globals.css
  "./postcss.config" → postcss.config.mjs
  "./lib/*" → src/lib/*.ts
  "./components/*" → src/components/*.tsx
  "./hooks/*" → src/hooks/*.ts
```

Components are built on:
- Radix UI primitives for accessible components
- Tailwind CSS v4 with PostCSS
- `class-variance-authority` for variant management
- `cn()` utility function (clsx + tailwind-merge) in `src/lib/utils.ts`

### Technology Stack

- **Runtime**: Bun 1.2.23
- **Framework**: Next.js 16 with Turbopack
- **React**: v19.2.0
- **Styling**: Tailwind CSS v4 via PostCSS
- **Linting/Formatting**: Biome 2.2.5
- **TypeScript**: 5.9.2
- **Build System**: Turborepo 2.5.8
- **UI Components**: shadcn/ui (new-york style) with Radix UI
- **Forms**: react-hook-form + zod validation
- **Icons**: lucide-react

## Common Commands

### Development

```bash
# Run all apps in development mode
bun run dev

# Run specific app
turbo dev --filter=web

# Run web app directly (uses Turbopack, port 3000)
cd apps/web && bun run dev
```

### Building

```bash
# Build all packages and apps
bun run build

# Build specific app
turbo build --filter=web
```

### Code Quality

```bash
# Lint all packages (uses Biome)
bun run lint

# Format code (uses Biome)
bun run format

# Type check all packages
bun run typecheck

# Lint and fix specific app
cd apps/web && bun run lint:fix
```

### Adding UI Components

The UI package uses shadcn/ui. Component configuration is in `packages/ui/components.json`:
- Style: new-york
- Base color: neutral
- CSS variables enabled
- Icon library: lucide-react

## Development Notes

### Biome Configuration

Biome is configured in `biome.json` with:
- Double quotes for JavaScript/TypeScript
- Space indentation
- Import type enforcement disabled (`useImportType: "off"`)
- Auto organize imports disabled
- Ignores `.next` and `.turbo` directories

### Turborepo Task Dependencies

Tasks defined in `turbo.json`:
- `build`: depends on `^build` (builds dependencies first)
- `lint`: depends on `^lint`
- `typecheck`: depends on `^typecheck`
- `dev`: no cache, persistent task

### Package Manager

This project uses Bun. Workspaces are configured in root `package.json`:
- `apps/*`
- `packages/*`

Always use `bun` commands, not npm/yarn/pnpm.

### TypeScript Configuration

Shared configs in `packages/typescript-config`:
- `base.json`: Base TypeScript config
- `nextjs.json`: Next.js-specific config
- `react-library.json`: React library config

### Working with UI Components

When modifying or adding components to `@kianax/ui`:
1. Components are in `packages/ui/src/components/`
2. Use the `cn()` utility for className merging
3. Follow Radix UI patterns for primitives
4. Export via the package.json exports field
5. Components use React Server Components (rsc: true)

### Import Aliases

When working in the UI package, use these aliases (defined in components.json):
- `@kianax/ui/components` → components
- `@kianax/ui/lib/utils` → utils
- `@kianax/ui/hooks` → hooks
- `@kianax/ui/lib` → lib

## Git Workflow

### Commit Message Convention

This project follows Conventional Commits format:

```
<type>(<scope>): <description>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance tasks, dependency updates
- `docs`: Documentation changes
- `refactor`: Code refactoring without feature changes
- `style`: Code style/formatting changes
- `test`: Test additions or modifications
- `perf`: Performance improvements
- `ci`: CI/CD configuration changes
- `build`: Build system or dependency changes

**Scope (optional):** The affected package or area (e.g., `create-turbo`, `web`, `ui`)

**Examples from this repo:**
- `feat: migrate to Biome, Tailwind v4, and rename to @kianax scope`
- `chore: remove unused public files & fonts`
- `feat(create-turbo): apply package-manager transform`

Recent activity shows migration work:
- Migrated from ESLint/Prettier to Biome
- Upgraded to Tailwind CSS v4
- Renamed packages to `@kianax` scope
- Removed unused docs app

The main branch is `main`.
