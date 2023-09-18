import { ServerPermissionLevel } from "./MinecraftHttpServer";

export interface IAuthenticationToken {
  time: number;
  code: string;
  permissionLevel: ServerPermissionLevel;
}
