# Minecraft Creator Tools

### Copyright (c) 2024 Mojang AB. All rights reserved.

- [License](https://aka.ms/mctlicense)
- [GitHub](https://aka.ms/mcthomepage)
- [Report an Issue](https://aka.ms/mctbugs)

This toolset is currently in alpha preview.

### Sample command lines

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

### New project creation

`npx mct create`

Asks a series of questions and creates a new project based on those preferences.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must follow [Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general). Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party’s policies.
