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

The page will reload if you make edits.

You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.

See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run jsnbuild`

Builds the command line application into `toolbuild/jsn` folder. You can then run the command line tool from `npx toolbuild\jsn`.

You can package the command-line by running `npm pack` in `toolbuild/jsn`.

### `npm run webbuild`

Builds the web app for production to the `build` folder. It correctly bundles React in production mode and optimizes the build for the best performance. The build is also minified.

## Sample Command Lines

Once packaged, you can install the command line locally via `npx mctools-<version>.tgz`. Some sample command lines:

`npx mct`

Displays default information for the Minecraft Creator Tools command line tool.

### Validation

`npx mct validate -i d:\mycontent\myprojectfolder`

Loads the project folder `d:\mycontent\myprojectfolder` and outputs result files into the default output folder `out`.

`npx mct validate -i d:\mycontent\myprojectfolder -show`

Loads the project folder `d:\mycontent\myprojectfolder` and shows validation results on the command line.

`npx mct validate addon -i d:\mycontent\myprojectfolder -show --log-verbose`

Loads the project folder `d:\mycontent\myprojectfolder`, validates using the 'addon' suite of strict tests and shows validation results on the command line. Also displays verbose logging messages.

`npx mct validate addon -if d:\mycontent\packages\myaddon.mcaddon -show --log-verbose`

Loads the project file `d:\mycontent\packages\myaddon.mcaddon`, validates using the 'addon' suite of strict tests and shows validation results on the command line. Also displays verbose logging messages.
