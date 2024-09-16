# Minecraft Creator Tools

This is project is a work in progress for a set of web-based tools for Minecraft Creators.

Visit the [documentation](https://mctools.dev/docs/) for more information on Minecraft Creator Tools and the current set of capabilities.

See the [changelog](CHANGELOG.md) for detailed updates and notes. If you have issues, please create a [GitHub issue](https://github.com/Mojang/minecraft-creator-tools/issues).

See the [Project Structure](ProjectStructure.md) file for a look at the structure of the codebase including a tour of major types.

## Using Creator Tools

Visit this web app via <https://mctools.dev>.

Enjoy!

## GitHub Repo & Developer Getting Started

Everything is built out of the `app` folder.

In the `app\` folder, run

```dotnetcli
npm run all
```

to install dependencies and resources, and compile projects.

## Build Scripts

In the project directory, you can run:

### `npm start` \ `npm run web`

Runs the app in the development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits. You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.

See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run jsnbuild`

Builds the command line application into `toolbuild/jsn` folder. You can then run the command line tool from `npx toolbuild\jsn`.

You can package the command-line by running `npm pack` in `toolbuild/jsn`.

### `npm run webbuild`

Builds the web app for production to the `build` folder. It correctly bundles React in production mode and optimizes the build for the best performance. The build is also minified.

## Command Line Tool

Once packaged, you can install the command line locally via `npm install minecraft-creator-tools-<version>.tgz`. If you'd like to make Minecraft Creator Tools available across your device, you can install it globally via `npm install -g minecraft-creator-tools-<version>.tgz`. Minecraft Creator Tools is also available on NPM via [@minecraft/creator-tools](https://aka.ms/mctnpm).

See the [command-line readme](./app/jsnode/README.md) for more instructions on using the command line.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must follow [Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general). Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party’s policies.
