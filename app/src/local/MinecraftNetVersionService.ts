/*{"result":{
  "links":[
    {"downloadType":"serverBedrockWindows","downloadUrl":"https://www.minecraft.net/bedrockdedicatedserver/bin-win/bedrock-server-1.21.102.1.zip"},
    {"downloadType":"serverBedrockLinux","downloadUrl":"https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.21.102.1.zip"},
    {"downloadType":"serverBedrockPreviewWindows","downloadUrl":"https://www.minecraft.net/bedrockdedicatedserver/bin-win-preview/bedrock-server-1.21.110.26.zip"},
    {"downloadType":"serverBedrockPreviewLinux","downloadUrl":"https://www.minecraft.net/bedrockdedicatedserver/bin-linux-preview/bedrock-server-1.21.110.26.zip"},
    {"downloadType":"serverJar","downloadUrl":"https://piston-data.mojang.com/v1/objects/<hash>/server.jar"}]
  }
}*/

export interface IMinecraftNetVersionService {
  result: IMinecraftNetVersionServiceLinkService;
}

export interface IMinecraftNetVersionServiceLinkService {
  links: IMinecraftNetVersionServiceLink[];
}

export interface IMinecraftNetVersionServiceLink {
  downloadType: string;
  downloadUrl: string;
}
