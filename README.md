# Minecraft Creator Tools v0.1.49

Web-, command-line-, and application-based tools for Minecraft creators.

Visit the [documentation](https://silver-guide-3a7f4789.pages.github.io/docs/) for more information on everything you can do with Minecraft Creator Tools.

See the [changelog](CHANGELOG.md) for detailed updates and notes. If you have issues, contact mikeam or create a [GitHub issue](https://github.com/Mojang/minecraft-developer-tools/issues).

See the [Project Structure](ProjectStructure.md) file for a look at the structure of the codebase including a tour of major types.

## Using Creator Tools

Visit this web app via <https://aka.ms/mctools>.

(this app is published to GitHub pages (<https://silver-guide-3a7f4789.pages.github.io/>), but <https://aka.ms/mctools> works better.

To use the Windows application, Visual Studio Code extension, command line tools, or server manager, visit the [releases](https://github.com/Mojang/minecraft-developer-tools/releases) page.

Enjoy!

## GitHub Repo & Developer Getting Started

Most everything (Windows App; VSCode Extension; web site; Node.js-based command line tools) is built out of the `web` folder.

In the `app\` folder, run

```dotnetcli
buildall.cmd
```

This will then in turn run:

```dotnetcli
npm i
```

to install dependencies.

Then, it will run:

```dotnetcli
npm run devenv
```

This will install additional dependencies and resources.

From there, it will build the web, JS Node (JSN), Visual Studio Code (VSC), and Windows app builds.

## Available Scripts

In the project directory, you can run:

### `npm start` \ `npm run web`

Runs the app in the development mode.
Open [http://localhost:3000?debug=true](http://localhost:3000?debug=true) to view it in the browser.

**_ IMPORTANT - note the extra URL params above. _**

The page will reload if you make edits.

You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.

See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run webbuild`

Builds the web app for production to the `build` folder. It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.

### `npm run jsnbuild`

Builds the node package/command line tool/self-hostable Minecraft server site to the `toolbuild\jsn` folder. Run `npm run jsncorebuild` for a shorter build of just the Node-side components (no UX web build.)

