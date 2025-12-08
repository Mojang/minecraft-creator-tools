# Minecraft Creator Tools Core Library

Core library for Minecraft Creator Tools - provides types and utilities for building Bedrock Edition add-ons.

## Installation

```bash
npm install @minecraft/creator-tools-core
```

## Usage

Import specific modules from subdirectories:

```typescript
import { Utilities } from "@minecraft/creator-tools-core/core/Utilities";
import Project from "@minecraft/creator-tools-core/app/Project";
import { MinecraftUtilities } from "@minecraft/creator-tools-core/minecraft/MinecraftUtilities";
import StoragePath from "@minecraft/creator-tools-core/storage/StoragePath";
```

## Available Modules

- **core/** - Core utilities and constants
- **app/** - Project and ProjectItem classes
- **minecraft/** - Minecraft-specific types and utilities
- **storage/** - Storage abstractions (IFile, IFolder, IStorage)
- **info/** - Info and metadata types
- **updates/** - Project update utilities
- **dataform/** - Data form definitions and utilities
- **manager/** - Various manager classes
- **devproject/** - Development project utilities

## Documentation

For full documentation, visit the main Minecraft Creator Tools repository.
