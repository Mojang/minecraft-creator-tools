import { expect } from "chai";
import ServerPropertiesManager, { ServerTransport } from "./ServerPropertiesManager";

function lines(manager: ServerPropertiesManager) {
  return manager.generateContent().split("\n");
}

describe("ServerPropertiesManager.generateContent", () => {
  it("defaults to the NetherNet transport", () => {
    expect(lines(new ServerPropertiesManager())).to.include("transport=nethernet");
  });

  it("writes the transport that was set", () => {
    const manager = new ServerPropertiesManager();
    manager.transport = ServerTransport.raknet;

    const output = lines(manager);

    expect(output).to.include("transport=raknet");
    expect(output).to.not.include("transport=nethernet");
  });

  it("writes allow-list rather than the legacy white-list key", () => {
    const manager = new ServerPropertiesManager();
    const output = manager.generateContent();

    expect(lines(manager)).to.include("allow-list=false");
    expect(output).to.not.contain("white-list");

    manager.allowList = true;
    expect(lines(manager)).to.include("allow-list=true");
  });

  it("maps the deprecated whiteList alias onto allowList", () => {
    const manager = new ServerPropertiesManager();
    manager.whiteList = true;

    expect(manager.allowList).to.equal(true);
    expect(lines(manager)).to.include("allow-list=true");
  });

  it("omits server-udp-ports unless it is set", () => {
    const manager = new ServerPropertiesManager();
    expect(manager.generateContent()).to.not.contain("server-udp-ports");

    manager.serverUdpPorts = "   ";
    expect(manager.generateContent()).to.not.contain("server-udp-ports");

    manager.serverUdpPorts = "49152-49200";
    expect(lines(manager)).to.include("server-udp-ports=49152-49200");
  });

  it("joins multi-line server-udp-ports entries into one line", () => {
    const manager = new ServerPropertiesManager();
    manager.serverUdpPorts = "19132:32000\n49152-49200\n";

    const udpLines = lines(manager).filter((line) => line.startsWith("server-udp-ports="));

    expect(udpLines).to.deep.equal(["server-udp-ports=19132:32000,49152-49200"]);
  });

  it("keeps the port settings in the output", () => {
    const manager = new ServerPropertiesManager();
    manager.serverPort = 19200;

    const output = lines(manager);

    expect(output).to.include("server-port=19200");
    expect(output).to.include("server-portv6=19133");
  });
});
