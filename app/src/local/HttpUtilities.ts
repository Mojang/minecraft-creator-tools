import * as http from "http";
import Utilities from "../core/Utilities";

export default class HttpUtilities {
  static getShortReqDescription(req: http.IncomingMessage) {
    return "req" + Utilities.getDateStr(new Date()) + " " + req.method + " " + req.url + ": ";
  }
}
