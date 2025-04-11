# Minecraft Creator Tools

This project is a work in progress for a set of web-based and command line tools for Minecraft creators.

Visit the [documentation](https://learn.microsoft.com/minecraft/creator/documents/mctoolsoverview) for more information on Minecraft Creator Tools and the current set of capabilities.

See the [changelog](CHANGELOG.md) for detailed updates and notes. If you have issues, please create a [GitHub issue](https://github.com/Mojang/minecraft-creator-tools/issues).

See the [Project Structure](ProjectStructure.md) file for a look at the structure of the codebase including a tour of major types.

Note that commonly, while working on this, most work is done from the "app" folder; all the default project settings are opened from there.

Please note that, at this time, we are not able to accept pull request contributions from the broader community.

## Using Creator Tools

Visit this web app via <https://mctools.dev>.

Enjoy!

## GitHub Repo & Developer Getting Started

Everything is built out of the `app` folder. To get started, you should have node.js installed (to give you access to NPM - the node package manager.) You can install 
node.js/npm from https://nodejs.org/. We'd recommend installing the latest LTS.

You may need to adjust permissions to allow for remote signed PowerShell scripts, if you're using a PowerShell-based shell. Consider the script execution policies 
you want to run with; to change the execution policy to remote signed, run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

In the `app\` folder, run

```dotnetcli
npm i
```

to install dependencies, and then

```dotnetcli
npm run all
```

to install more resources, and compile projects.

## Build Scripts

In the project directory, you can run:

### `npm start` \ `npm run web`

Runs the app in the development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits. You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.

IMPORTANT: Make sure you go into <repo>/samplecontent/addon and ensure the sample is built via:

```dotnetcli
npm i
```

and then

```dotnetcli
npx gulp package
```

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
