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

to install dependencies and resources.

## Available Scripts

In the project directory, you can run:

### `npm start` \ `npm run web`

Runs the app in the development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.

You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.

See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run webbuild`

Builds the web app for production to the `build` folder. It correctly bundles React in production mode and optimizes the build for the best performance. The build is also minified.
