// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockCube from "../minecraft/BlockCube";
import Structure from "../minecraft/Structure";

export default class ProjectContent {
  static defaultTestJavaScript = `import * as gt from "@minecraft/server-gametest";
import * as mc from "@minecraft/server";
        
function basicTest(test) {
    const zoglinEntityType = "zoglin";
    const skeletonEntityType = "skeleton";
        
    test.spawn(zoglinEntityType, new mc.BlockLocation(2, 2, 3));
    test.spawn(skeletonEntityType, new mc.BlockLocation(5, 2, 3));
    
    test.succeedWhen( ()=> {
            test.assertEntityPresentInArea(skeletonEntityType, false);
        }
    );
}
        
gt.register("MyProject", "basicTest", basicTest).structureName("gametests:basic");     
`;

  static emptyTestJavaScript = `import * as gt from "@minecraft/server-gametest";
import * as mc from "@minecraft/server";
        
function basicTest(test) {

}
        
gt.register("MyProject", "basicTest", basicTest).structureName("gametests:basic");     
`;

  static emptyJavaScript = `import * as mc from "@minecraft/server";
        
function myFunction() 
{

}
`;

  static emptyActionSet = `{
}
`;

  static emptyWorldTest = `{
}
`;

  static getItemName(name: string) {
    name = name.trim();
    name = name.replace(/ /gi, "");

    if (name.length > 3 && name.charAt(0) >= "A" && name.charAt(0) <= "Z") {
      name = name[0].toLowerCase() + name.substring(1, name.length);
    }

    return name;
  }

  static getDefaultTestJavaScript(projectName: string, testName: string) {
    let content = ProjectContent.defaultTestJavaScript;

    content = this.replaceCommonItems(content, projectName);

    content = content.replace(/basicTest/gi, ProjectContent.getItemName(testName));

    return content;
  }

  static getDefaultTestTypeScript(projectName: string, testName: string) {
    let content = ProjectContent.defaultTestJavaScript;

    content = content.replace("(test)", "(test : gt.Test)");

    content = this.replaceCommonItems(content, projectName);

    content = content.replace(/basicTest/gi, ProjectContent.getItemName(testName));

    return content;
  }

  static getEmptyTestJavaScript(projectName: string, testName: string) {
    let content = ProjectContent.emptyTestJavaScript;

    content = this.replaceCommonItems(content, projectName);

    content = content.replace(/basicTest/gi, ProjectContent.getItemName(testName));

    return content;
  }

  static getEmptyTestTypeScript(projectName: string, testName: string) {
    let content = ProjectContent.emptyTestJavaScript;

    content = content.replace("(test)", "(test : gt.Helper)");

    content = this.replaceCommonItems(content, projectName);

    content = content.replace(/basicTest/gi, ProjectContent.getItemName(testName));

    return content;
  }

  static replaceCommonItems(content: string, projectName: string) {
    return content.replace('"MyProject"', '"' + ProjectContent.getItemName(projectName) + '"');
  }

  static getEmptyActionSet(projectName: string, testName: string) {
    const content = ProjectContent.emptyActionSet;

    return content;
  }

  static getEmptyWorldTest(projectName: string, testName: string) {
    const content = ProjectContent.emptyActionSet;

    return content;
  }

  static getEmptyJavaScript(projectName: string, testName: string) {
    let content = ProjectContent.emptyJavaScript;

    content = content.replace("myFunction", ProjectContent.getItemName(projectName) + "Action");

    return content;
  }

  static getEmptyTypeScript(projectName: string, testName: string) {
    return this.getEmptyJavaScript(projectName, testName);
  }

  static generateDefaultStructure() {
    const structure = new Structure();
    const cube = new BlockCube();

    cube.setMaxDimensions(8, 8, 8);

    structure.cube = cube;

    cube.fillY("minecraft:dirt", 0);
    cube.fillEmpty("minecraft:glass", 0, 1, 0, 7, 7, 7);

    return structure.getMCStructureBytes();
  }
}
