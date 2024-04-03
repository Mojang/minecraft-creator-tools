# Minecraft Creator Tools Readme

### Copyright (c) 2024 Mojang AB. All rights reserved.

- [License](LICENSE.md)
- [Changelog](CHANGELOG.md)
- [Notices](NOTICE.md)

This code is currently in alpha preview.

### Some sample command lines:

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
