// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const fs = require("fs");
const path = require("path");
const { decodeTga } = require("@lunapaint/tga-codec");
const { PNG } = require("pngjs");

/**
 * Updates index.json files to include PNG files that were converted from TGA.
 * @param {string} targetPath - The directory path to search for index.json files
 * @param {boolean} verbose - Whether to log updates
 * @returns {Promise<number>} - Count of index.json files updated
 */
async function updateIndexJsonFiles(targetPath, verbose = false) {
  let updated = 0;

  if (!fs.existsSync(targetPath)) {
    return updated;
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);

    if (entry.isDirectory()) {
      updated += await updateIndexJsonFiles(fullPath, verbose);
    } else if (entry.isFile() && entry.name === "index.json") {
      try {
        const content = fs.readFileSync(fullPath, "utf8");
        const indexData = JSON.parse(content);

        if (indexData.files && Array.isArray(indexData.files)) {
          // Get actual files in directory
          const dirPath = path.dirname(fullPath);
          const actualFiles = fs.readdirSync(dirPath).filter((f) => {
            const filePath = path.join(dirPath, f);
            return fs.statSync(filePath).isFile() && f !== "index.json";
          });

          // Check if there are PNG files not in the index
          const pngsNotInIndex = actualFiles.filter(
            (f) => f.toLowerCase().endsWith(".png") && !indexData.files.includes(f)
          );

          if (pngsNotInIndex.length > 0) {
            // Add missing PNG files to the index
            for (const pngFile of pngsNotInIndex) {
              indexData.files.push(pngFile);
            }

            // Sort files alphabetically
            indexData.files.sort();

            // Write updated index.json
            fs.writeFileSync(fullPath, JSON.stringify(indexData, null, 2));
            updated++;

            if (verbose) {
              console.log(`Updated ${fullPath} with ${pngsNotInIndex.length} new PNG files`);
            }
          }
        }
      } catch (err) {
        if (verbose) {
          console.warn(`Failed to update ${fullPath}: ${err.message}`);
        }
      }
    }
  }

  return updated;
}

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

      // Update index.json files to include the new PNG files
      let totalIndexUpdated = 0;
      for (const dir of directories) {
        const indexUpdated = await updateIndexJsonFiles(dir, false);
        totalIndexUpdated += indexUpdated;
      }

      if (totalIndexUpdated > 0) {
        console.log(`Updated ${totalIndexUpdated} index.json files with new PNG entries`);
      }

      callback(null, chunk);
    } catch (err) {
      callback(err);
    }
  });
}

module.exports = tgaToPng;
module.exports.convertTgaFilesInDirectory = convertTgaFilesInDirectory;
module.exports.updateIndexJsonFiles = updateIndexJsonFiles;
