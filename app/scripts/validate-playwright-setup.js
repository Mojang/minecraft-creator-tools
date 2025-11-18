#!/usr/bin/env node

/**
 * Validation script to check Playwright setup for MCTools
 * This script verifies that the Playwright testing environment is properly configured
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🧪 Playwright Setup Validation for MCTools\n");

function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  console.log(`${exists ? "✅" : "❌"} ${description}: ${filePath}`);
  return exists;
}

function runCommand(command, description) {
  try {
    const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });
    console.log(`✅ ${description}`);
    return { success: true, output };
  } catch (error) {
    console.log(`❌ ${description}: ${error.message}`);
    return { success: false, error };
  }
}

let allChecksPass = true;

// Check configuration files
console.log("📁 Configuration Files:");
allChecksPass &= checkFile("playwright.config.ts", "Main Playwright config");
allChecksPass &= checkFile("playwright-system.config.ts", "System browser config");
allChecksPass &= checkFile("package.json", "Package.json");

// Check test directories
console.log("\n📂 Test Directories:");
allChecksPass &= checkFile("src/testweb", "Test directory");
allChecksPass &= checkFile("src/testweb/Basic.spec.ts", "Basic test file");
allChecksPass &= checkFile("src/testweb/Advanced.spec.ts", "Advanced test file");

// Check dependencies
console.log("\n📦 Dependencies:");
try {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
  const hasPlaywright =
    packageJson.devDependencies &&
    (packageJson.devDependencies["@playwright/test"] || packageJson.devDependencies["playwright"]);
  console.log(`${hasPlaywright ? "✅" : "❌"} Playwright dependency in package.json`);
  allChecksPass &= hasPlaywright;
} catch (error) {
  console.log(`❌ Error reading package.json: ${error.message}`);
  allChecksPass = false;
}

// Check npm scripts
console.log("\n🔧 NPM Scripts:");
try {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
  const scripts = packageJson.scripts || {};
  const expectedScripts = ["test-web", "test-web-system", "test-web-list"];

  expectedScripts.forEach((script) => {
    const exists = scripts[script];
    console.log(`${exists ? "✅" : "❌"} npm script: ${script}`);
    allChecksPass &= !!exists;
  });
} catch (error) {
  console.log(`❌ Error checking npm scripts: ${error.message}`);
  allChecksPass = false;
}

// Check Playwright installation
console.log("\n🎭 Playwright Installation:");
const playwrightCheck = runCommand("npx playwright --version", "Playwright CLI available");
allChecksPass &= playwrightCheck.success;

// Check test discovery
console.log("\n🔍 Test Discovery:");
const testListCheck = runCommand("npx playwright test --list", "Test discovery");
if (testListCheck.success) {
  const testCount = testListCheck.output.match(/Total: (\d+) tests/)?.[1] || "0";
  console.log(`   Found ${testCount} tests`);
}
allChecksPass &= testListCheck.success;

// Check system browsers
console.log("\n🌐 System Browsers:");
const browsers = ["chromium-browser", "google-chrome", "firefox"];
let systemBrowserAvailable = false;

browsers.forEach((browser) => {
  const check = runCommand(`which ${browser}`, `${browser} available`);
  if (check.success) {
    systemBrowserAvailable = true;
  }
});

if (systemBrowserAvailable) {
  console.log("✅ At least one system browser is available");
} else {
  console.log("⚠️  No system browsers found - Playwright browsers required");
}

// Final status
console.log("\n" + "=".repeat(50));
if (allChecksPass) {
  console.log("🎉 All checks passed! Playwright setup is ready.");
  console.log("\nNext steps:");
  console.log("1. Install browsers: npx playwright install");
  console.log("2. Start dev server: npm run web");
  console.log("3. Run tests: npm run test-web");
  console.log("4. Or use system browsers: npm run test-web-system");
} else {
  console.log("❌ Some checks failed. Please review the issues above.");
  process.exit(1);
}
