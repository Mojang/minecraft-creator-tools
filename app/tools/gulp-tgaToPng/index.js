// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const fs = require("fs");
const path = require("path");
const { decodeTga } = require("@lunapaint/tga-codec");
const { PNG } = require("pngjs");

/**
 * Recursively finds all TGA files in a directory and converts them to PNG.
 * @param {string} targetPath - The directory path to search for TGA files
 * @param {boolean} verbose - Whether to log individual file failures
 * @returns {Promise<{converted: number, failed: number}>} - Counts of converted and failed files
 */
async function convertTgaFilesInDirectory(targetPath, verbose = false) {
  let converted = 0;
  let failed = 0;

  if (!fs.existsSync(targetPath)) {
    console.log(`Directory does not exist: ${targetPath}`);
    return { converted, failed };
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      const result = await convertTgaFilesInDirectory(fullPath, verbose);
      converted += result.converted;
      failed += result.failed;
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".tga")) {
      const pngPath = fullPath.replace(/\.tga$/i, ".png");

      // Skip if PNG already exists
      if (fs.existsSync(pngPath)) {
        continue;
      }

      try {
        const tgaData = fs.readFileSync(fullPath);
        const decoded = await decodeTga(tgaData);

        if (!decoded || !decoded.image || !decoded.image.width || !decoded.image.height) {
          if (verbose) {
            console.warn(`Skipped ${fullPath}: Could not decode TGA image data`);
          }
          failed++;
          continue;
        }

        const png = new PNG({
          width: decoded.image.width,
          height: decoded.image.height,
        });

        // Copy RGBA data from decoded TGA to PNG
        // The decoded.image.data is already in RGBA format
        png.data = Buffer.from(decoded.image.data);

        // Write PNG file
        const pngBuffer = PNG.sync.write(png);
        fs.writeFileSync(pngPath, pngBuffer);

        converted++;
      } catch (err) {
        if (verbose) {
          console.warn(`Failed to convert ${fullPath}: ${err.message}`);
        }
        failed++;
      }
    }
  }

  return { converted, failed };
}

/**
 * Gulp plugin that converts TGA files to PNG in specified directories.
 * @param {string[]} directories - Array of directory paths to process
 */
function tgaToPng(directories) {
  const through2 = require("through2");

  return through2.obj(async function (chunk, encoding, callback) {
    try {
      let totalConverted = 0;
      let totalFailed = 0;

      for (const dir of directories) {
        console.log(`Converting TGA files to PNG in: ${dir}`);
        const result = await convertTgaFilesInDirectory(dir, false);
        totalConverted += result.converted;
        totalFailed += result.failed;
        if (result.converted > 0) {
          console.log(`  Converted ${result.converted} TGA files to PNG in ${dir}`);
        }
      }

      if (totalConverted > 0) {
        console.log(`Total: Converted ${totalConverted} TGA files to PNG`);
      } else {
        console.log("No new TGA files needed conversion (PNG versions already exist)");
      }

      if (totalFailed > 0) {
        console.log(`Note: ${totalFailed} TGA files could not be converted (unsupported format)`);
      }

      callback(null, chunk);
    } catch (err) {
      callback(err);
    }
  });
}

module.exports = tgaToPng;
module.exports.convertTgaFilesInDirectory = convertTgaFilesInDirectory;
