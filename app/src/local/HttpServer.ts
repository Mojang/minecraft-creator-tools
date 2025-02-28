import * as http from "http";
import * as https from "https";
import ServerManager, { ServerManagerFeatures } from "./ServerManager";
import LocalEnvironment from "./LocalEnvironment";
import { ServerPermissionLevel } from "./IAuthenticationToken";
import Log from "../core/Log";
import ZipStorage from "../storage/ZipStorage";
import Carto from "../app/Carto";
import Utilities from "../core/Utilities";
import Project from "../app/Project";
import { ProjectInfoSuite } from "../info/IProjectInfoData";
import ProjectInfoSet from "../info/ProjectInfoSet";
import IProjectMetaState from "../info/IProjectMetaState";
import ProjectInfoUtilities from "../info/ProjectInfoUtilities";

// these definitions are duplicated for the client and should be kept in sync in CartoAuthentication.ts
export interface CartoServerAuthenticationResponse {
  token?: string;
  iv?: string;
  permissionLevel: ServerPermissionLevel;
  serverStatus: CartoServerStatusResponse[];
}

export interface CartoServerStatusResponse {
  id: number;
  time: number;
}

export default class HttpServer {
  host = "localhost";
  public port = 80;

  public carto: Carto | undefined;

  headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS, POST, PUT, GET, PATCH",
    "Access-Control-Max-Age": 2592000,
    "Access-Control-Allow-Headers": "*",
  };

  private _serverManager: ServerManager;
  private _localEnvironment: LocalEnvironment;

  private _httpsServer: https.Server | undefined;
  private _httpServer: http.Server | undefined;

  constructor(localEnv: LocalEnvironment, serverManager: ServerManager) {
    this._serverManager = serverManager;

    this._localEnvironment = localEnv;

    this.processRequest = this.processRequest.bind(this);
  }

  init() {
    const requestListener = this.processRequest;

    if (this._localEnvironment && this._localEnvironment.serverHostPort) {
      this.port = this._localEnvironment.serverHostPort;
    }

    if (this._localEnvironment && this._localEnvironment.serverDomainName) {
      this.host = this._localEnvironment.serverDomainName;
    }

    this._httpServer = http.createServer(requestListener);
    this._httpServer.listen(this.port, this.host, () => {
      Log.message(`Minecraft http server is running on http://${this.host}:${this.port}`);
    });
  }

  stop() {
    if (this._httpServer) {
      this._httpServer.close(() => {
        Log.message(`Minecraft http server closed.`);
      });
    }

    if (this._httpsServer) {
      this._httpsServer.close(() => {
        Log.message(`Minecraft https server closed.`);
      });
    }
  }

  getRootPath() {
    let fullPath = __dirname;

    const lastSlash = Math.max(
      fullPath.lastIndexOf("\\", fullPath.length - 2),
      fullPath.lastIndexOf("/", fullPath.length - 2)
    );

    if (lastSlash >= 0) {
      fullPath = fullPath.substring(0, lastSlash + 1);
    }

    return fullPath;
  }

  parseCookies(req: http.IncomingMessage): { [name: string]: string } {
    const result: { [name: string]: string } = {};

    const cookieHeader = req.headers?.cookie;

    if (!cookieHeader) return result;

    const cookieVals = cookieHeader.split(`;`);

    for (let i = 0; i < cookieVals.length; i++) {
      const cookie = cookieVals[i];

      let [name, ...rest] = cookie.split(`=`);

      name = name?.trim();

      if (!name) {
        return result;
      }

      const value = rest.join(`=`).trim();

      if (!value) {
        return result;
      }

      result[name] = decodeURIComponent(value);
    }

    return result;
  }

  processRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.method === "OPTIONS") {
      res.writeHead(204, this.headers);
      res.end();
      return;
    }

    if (!req.url) {
      res.writeHead(404, this.headers);
      Log.message("Requested url was not specified.");
      return;
    }

    let authorizedPermissionLevel: ServerPermissionLevel = ServerPermissionLevel.none;

    let headerPasscode: string | undefined = undefined;
    if (req.headers["mctpc"]) {
      headerPasscode = req.headers["mctpc"] as string;
    }

    if (headerPasscode) {
      if (headerPasscode === this._localEnvironment.displayReadOnlyPasscode) {
        authorizedPermissionLevel = ServerPermissionLevel.displayReadOnly;
      } else if (headerPasscode === this._localEnvironment.fullReadOnlyPasscode) {
        authorizedPermissionLevel = ServerPermissionLevel.fullReadOnly;
      } else if (headerPasscode === this._localEnvironment.updateStatePasscode) {
        authorizedPermissionLevel = ServerPermissionLevel.updateState;
      } else if (headerPasscode === this._localEnvironment.adminPasscode) {
        authorizedPermissionLevel = ServerPermissionLevel.admin;
      } else {
        this.sendErrorRequest(401, "Invalid passcode passed in via mctpc header.", req, res);
        return;
      }
    }

    if (this._serverManager.features === ServerManagerFeatures.all) {
    }

    let encryptedToken: string | undefined;
    const auth = req.headers.authorization;

    if (auth && auth.length > 40) {
      // assume that the auth token > 40
      const authStr = auth as string;

      const firstSection = authStr.substring(0, 7).toLowerCase();

      if (firstSection === "bearer " && auth.indexOf("=") >= 0) {
        const tokenPart = authStr.substring(7);
        const tokenParts = tokenPart.split("=");

        if (tokenParts.length === 2) {
          if (tokenParts[0] === "mctauth") {
            encryptedToken = tokenParts[1];
          }
        }
      }
    }

    if (!encryptedToken) {
      const cookies = this.parseCookies(req);

      const authCookie = cookies["mctauth"];

      if (authCookie) {
        encryptedToken = authCookie;
      }
    }

    if (authorizedPermissionLevel === ServerPermissionLevel.none) {
      this.sendErrorRequest(401, "No permissions granted; 401 returned.", req, res);
      return;
    }

    const urlSegments = req.url.toLowerCase().split("/");

    if (urlSegments.length >= 2) {
      if (urlSegments[1] === "api") {
        if (
          urlSegments[2] === "validate" &&
          req.method === "POST" &&
          req.headers["content-type"] === "application/zip"
        ) {
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          const body: any[] = [];
          req.on("data", (chunk) => {
            body.push(Buffer.from(chunk, "binary"));
          });
          req.on("end", async () => {
            if (body.length >= 1) {
              const bodyContent = Buffer.concat(body);

              if (!this.carto) {
                this.sendErrorRequest(500, "Unexpected configuration.", req, res);
                return;
              }

              const zipStorage = new ZipStorage();

              const contentUint = new Uint8Array(bodyContent);

              Log.message(this.getShortReqDescription(req) + "Received package of " + contentUint.length + " bytes");

              try {
                await zipStorage.loadFromUint8Array(contentUint);
              } catch (e) {
                this.sendErrorRequest(400, "Error processing passed-in validation package.", req, res);
                return;
              }

              if (!res.headersSent) {
                res.writeHead(200, this.headers);
              }

              const packProject = new Project(this.carto, "Test", null);
              packProject.setProjectFolder(zipStorage.rootFolder);

              await packProject.inferProjectItemsFromFiles();

              let suiteInst: ProjectInfoSuite = ProjectInfoSuite.default;
              let excludeTests: string[] = [];

              if (req.headers["mctsuite"] && typeof req.headers["mctsuite"] == "string") {
                suiteInst = ProjectInfoSet.getSuiteFromString(req.headers["mctsuite"]);
              }

              if (req.headers["mctexcludeTests"] && typeof req.headers["mctexcludeTests"] == "string") {
                excludeTests = req.headers["mctexcludeTests"].split(",");
              }

              const pis = new ProjectInfoSet(packProject, suiteInst, excludeTests);

              await pis.generateForProject();

              let subsetReports: IProjectMetaState[] = [];

              if (req.headers["mctsuite"] === "all") {
                subsetReports = await ProjectInfoUtilities.getDerivedStates(packProject, pis);
              }

              const result = JSON.stringify(pis.getDataObject(undefined, undefined, undefined, false, subsetReports));

              res.write(result);
              res.end();

              if (this._serverManager.runOnce) {
                this._serverManager.shutdown(
                  "Shutting down due to completion of one validation operation in runOnce mode."
                );
              }

              return;
            } else {
              this.sendErrorRequest(400, "Unexpected post type: " + body.length, req, res);
              return;
            }
          });

          return;
        }

        let portOrSlot = -1;

        try {
          portOrSlot = parseInt(urlSegments[2]);
        } catch (e) {}

        if (portOrSlot < 0 || portOrSlot > 65536 || portOrSlot === 80 || portOrSlot === 443) {
          this.sendErrorRequest(400, "Unexpected port or slot specified", req, res);
          return;
        }

        if (urlSegments[3] === "status" && req.method === "GET") {
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.displayReadOnly, req, res)) {
            return;
          }

          const status = this.getStatus(portOrSlot);

          Log.message(this.getShortReqDescription(req) + "Status: " + JSON.stringify(status));

          res.writeHead(200, this.headers);
          res.write(JSON.stringify(status));
          res.end();
          return;
        } else if (urlSegments[3] === "updateStatus" && req.method === "POST") {
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          const body: any[] = [];
          req.on("data", (chunk) => {
            body.push(chunk);
          });
          req.on("end", () => {
            if (body.length === 1) {
              const val = body[0].toString();

              let updates: any | undefined;

              try {
                updates = JSON.parse(val);
              } catch (e) {}

              if (updates && updates.length) {
                for (let i = 0; i < updates.length; i++) {
                  const upd = updates[i];
                }
              }

              res.writeHead(200, this.headers);
              res.end();
              return;
            } else {
              res.writeHead(500, this.headers);
              res.end();
              return;
            }
          });
        } else if (urlSegments[3] === "command" && req.method === "POST") {
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.updateState, req, res)) {
            return;
          }

          const body: any[] = [];
          req.on("data", (chunk) => {
            body.push(chunk);
          });
          req.on("end", () => {
            if (body.length === 1) {
              const val = body[0].toString();
              res.writeHead(200, this.headers);
              res.end();
              return;
            } else {
              res.writeHead(500, this.headers);
              res.end();
              return;
            }
          });
        } else if (
          urlSegments[3] === "upload" &&
          (req.method === "POST" || req.method === "PATCH") &&
          req.headers["content-type"] === "application/zip"
        ) {
          if (!this.hasPermissionLevel(authorizedPermissionLevel, ServerPermissionLevel.admin, req, res)) {
            return;
          }

          const body: any[] = [];
          req.on("data", (chunk) => {
            body.push(chunk);
          });
          req.on("end", async () => {
            if (body.length === 1) {
              const zipStorage = new ZipStorage();

              const contentUint = new Uint8Array(body[0]);

              Log.message(
                this.getShortReqDescription(req) + "Received update package of " + contentUint.length + " bytes"
              );

              try {
                await zipStorage.loadFromUint8Array(contentUint);
              } catch (e) {
                res.writeHead(400, this.headers);
                res.end();
                return;
              }

              let isReloadable = false;
              if (req.headers["mctools-reloadable"]) {
                isReloadable = true;
              }

              res.writeHead(200, this.headers);
              res.end();

              if (this._serverManager.runOnce) {
                this._serverManager.shutdown(
                  "Shutting down due to completion of one deploy operation in runOnce mode."
                );
              }

              return;
            }
          });
        }
      }
    }

    res.writeHead(500, this.headers);
    res.end();
  }

  getShortReqDescription(req: http.IncomingMessage) {
    return "req" + Utilities.getDateStr(new Date()) + " " + req.method + " " + req.url + ": ";
  }

  getStatus(portOrSlot: number) {
    return {
      id: -1,
      time: new Date().getTime(),
    };
  }

  sendErrorRequest(statusCode: number, message: string, req: http.IncomingMessage, res: http.ServerResponse) {
    Log.message(this.getShortReqDescription(req) + "Error request: " + message);
    if (!res.headersSent) {
      res.writeHead(statusCode, this.headers);
    }
    res.write(message);
    res.end();
  }

  hasPermissionLevel(
    currentPermLevel: ServerPermissionLevel,
    requiredPermissionLevel: ServerPermissionLevel,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) {
    if (currentPermLevel < requiredPermissionLevel) {
      Log.message(
        this.getShortReqDescription(req) +
          "Current permissions (" +
          +currentPermLevel +
          ") granted, but (" +
          requiredPermissionLevel +
          ") needed; 401 returned."
      );
      res.writeHead(401, this.headers);
      res.end("API call failed due to insufficient permissions (" + requiredPermissionLevel + ")");
      return false;
    }

    return true;
  }
}
