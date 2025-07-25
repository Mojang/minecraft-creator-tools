This is a TypeScript based repository that cross compiles as a React web application and as a NodeJS based command line tool. It is primarily responsible for editing creative projects for Minecraft: Bedrock Edition. Please follow these guidelines when contributing:

This project uses NPM modules. It requires NPM version 10 or higher, and NodeJS version 22 or higher. It is recommended to use the latest LTS version of NodeJS.

## Code Standards

### Required Before Each Commit

- Run tests to ensure that they are correct.

### Initial environment setup

The following ssteps are recommended for development, and should be automatically done via copilot-setup-steps.yml:

- Build the sample content: in `samplecontent/addon`, run `npm ci` and then `npx gulp package`.
- In the `app/` folder, run `npm ci` and then `npm run preparedevenv` to prepare the developer environment.

### Development Flow

- Run builds after changing code: `npm run corebuild` (in the `app/` folder). This will re-build the NodeJS command line tool and the website.
- The command line tool can be run via `npx mct` after building. Frequently, you will want to use the `npx mct validate -i <path to folder of content>` command to validate content and test that the results are expected.
- Test: `npm test`

## Repository Structure

Note: most project work is in the `app` folder.

- `app/`: Main folder with application source code
- `app/src/`: Main source code with application source code
- `app/public/`: Data files and static assets for the web application
- `app/jsnode/`: Files to be packaged into the NodeJS command line tool
- `app/debugoutput/`: Files created while debugging or for temporary purposes; ignore these files in pull requests
- `app/build/`: Build output folder for the website version of the applicastion
- `app/out/`: Build output folder for the Electron version of the applicastion
- `app/test/`: Many tests compare current built-file outputs (in `app/test/results/`) against expected outputs (in `app/test/scenarios/`). Do not edit files in `app/test/results`.
- `app/toolbuild/`: Build output folder for the JSNode and VSCode versions of the application
- `app/site/`: Folder with modifications to index.html when hosted on mctools.dev (adds cookie and analytics scripts)
- `app/reslist/`: Contains JSON metadata for how to include additional resources into MCTools at build time
- Code within `app/public/data/forms` and `app/src/minecraft/json` is generated from the `app/src/minecraft/` folder. Do not edit or comment on files in these directories directly.

## Testing Strategy

Tests are added either in `app/src/test/CartoTest.ts`, or added into `app/src/test/CommandLineTest.ts` for command line tool tests.

The `app/src/test/` folder is used for unit tests, while the `app/test/` folder is used for integration tests that compare built outputs (`app/test/results`) against expected outputs (`app/test/scenarios`).

There is some sample content in the `samplecontent` folder, which can be used to test the command line tool. The `samplecontent/addon` folder contains a sample addon that can be used to test the command line tool.

Please add more canonical Minecraft Bedrock Edition content to the `samplecontent/` folder as you find it, so that it can be used to test the command line tool.

## Sample content

Because this project works with Minecraft content, it is important to have sample content to test and validate stucture against.

More sample content can be found in the `samplecontent/` folder, and it will be included in the build output.

After `npm run preparedevenv` is run:

- a lot of sample content is available in `app/public/res/samples` folder. This includes sample packs, worlds, and addons that can be used to test the command line tool.
- You can find a lot of vanilla samples content in `app/public/res/latest/van` folder.

Documentation on Minecraft Bedrock Edition can be found in markdown files on GitHub, at https://github.com/microsoftdocs/minecraft-creator.
Please review that content for more information on Minecraft Bedrock Edition content structure.

## Key Guidelines

1. Follow TypeScript best practices and idiomatic patterns
2. Maintain existing code structure and organization
3. Write unit tests for new functionality. Use table-driven unit tests when possible.
4. Document or add notes on the project architecture or technical implementation into the `docs` folder. Title articles with the name of the feature or functionality, along with dates when last revised.

## Important: When working through changes to streamline building and testing of this content, please update this documentation file to reflect best practices and useful knowledge. When updating build processes, please update the related build process files (typically, package.json or gulpfile.js) to make future builds more simple. This ensures future Copilot interactions have accurate context about the current state of the codebase.
