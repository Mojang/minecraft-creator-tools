/**
 * Generate JSON Schemas from TypeScript interfaces.
 *
 * This script uses ts-json-schema-generator to convert TypeScript interfaces
 * in the dataform folder (and other configured folders) into JSON Schema files.
 *
 * Usage:
 *   node scripts/generateJsonSchemas.js
 *   npm run generate-schemas
 *
 * Output:
 *   public/schemas/dataform/*.schema.json
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Configuration for schema generation
const SCHEMA_CONFIGS = [
  {
    // Summarizer-related types
    name: "summarizer",
    sourceFile: "src/dataform/ISummarizer.ts",
    types: ["ISummarizer"],
    outputDir: "public/schemas/dataform",
  },
  {
    // Summarizer token types
    name: "summarizer-token",
    sourceFile: "src/dataform/ISummarizerToken.ts",
    types: ["ISummarizerToken"],
    outputDir: "public/schemas/dataform",
  },
  {
    // Form definition types
    name: "form-definition",
    sourceFile: "src/dataform/IFormDefinition.ts",
    types: ["IFormDefinition"],
    outputDir: "public/schemas/dataform",
  },
  {
    // Field types
    name: "field",
    sourceFile: "src/dataform/IField.ts",
    types: ["IField"],
    outputDir: "public/schemas/dataform",
  },
  {
    // Condition types
    name: "condition",
    sourceFile: "src/dataform/ICondition.ts",
    types: ["ICondition"],
    outputDir: "public/schemas/dataform",
  },
];

// Base directory
const BASE_DIR = path.resolve(__dirname, "..");

/**
 * Ensure output directory exists
 */
function ensureDir(dirPath) {
  const fullPath = path.join(BASE_DIR, dirPath);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Generate a JSON schema for a specific type
 */
function generateSchema(config) {
  const { name, sourceFile, types, outputDir } = config;

  // Ensure output directory exists
  ensureDir(outputDir);

  for (const typeName of types) {
    const outputFile = path.join(outputDir, `${name}.schema.json`);
    const fullSourcePath = path.join(BASE_DIR, sourceFile);
    const fullOutputPath = path.join(BASE_DIR, outputFile);

    // Check if source file exists
    if (!fs.existsSync(fullSourcePath)) {
      console.warn(`Warning: Source file not found: ${sourceFile}`);
      continue;
    }

    console.log(`Generating schema for ${typeName} from ${sourceFile}...`);

    try {
      // Use ts-json-schema-generator CLI
      const cmd = [
        "npx",
        "ts-json-schema-generator",
        "--path",
        `"${fullSourcePath}"`,
        "--type",
        typeName,
        "--tsconfig",
        `"${path.join(BASE_DIR, "tsconfig.json")}"`,
        "--no-type-check", // Skip type checking for speed
        "--expose",
        "all", // Expose all types, not just exported ones
        "--additional-properties", // Allow additional properties for flexibility (no argument)
        "--markdown-description", // Include markdown descriptions from JSDoc
      ].join(" ");

      const result = execSync(cmd, {
        cwd: BASE_DIR,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large schemas
      });

      // Parse and enhance the schema
      const schema = JSON.parse(result);

      // Add metadata
      schema.$id = `https://github.com/Mojang/minecraft-creator-tools/schemas/dataform/${name}.schema.json`;
      schema.$comment = `Generated from ${sourceFile} - do not edit manually`;

      // Write the schema file
      fs.writeFileSync(fullOutputPath, JSON.stringify(schema, null, 2) + "\n");
      console.log(`  ✓ Generated: ${outputFile}`);
    } catch (error) {
      console.error(`  ✗ Failed to generate schema for ${typeName}:`);
      console.error(`    ${error.message}`);

      // Try to extract more useful error info
      if (error.stderr) {
        console.error(`    ${error.stderr}`);
      }
    }
  }
}

/**
 * Main function
 */
function main() {
  console.log("=== JSON Schema Generation ===\n");

  // Ensure base schemas directory exists
  ensureDir("public/schemas");
  ensureDir("public/schemas/dataform");

  // Generate schemas for each config
  for (const config of SCHEMA_CONFIGS) {
    generateSchema(config);
  }

  console.log("\n=== Schema generation complete ===");

  // Generate an index file listing all schemas
  const indexPath = path.join(BASE_DIR, "public/schemas/dataform/index.json");
  const schemaFiles = fs
    .readdirSync(path.join(BASE_DIR, "public/schemas/dataform"))
    .filter((f) => f.endsWith(".schema.json"));

  const index = {
    $comment: "Index of generated JSON schemas for dataform types",
    generatedAt: new Date().toISOString(),
    schemas: schemaFiles.map((f) => ({
      name: f.replace(".schema.json", ""),
      file: f,
      path: `/schemas/dataform/${f}`,
    })),
  };

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
  console.log(`Generated index: public/schemas/dataform/index.json`);
}

// Run main
main();
