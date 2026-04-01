import PackStorage from "../../files/PackStorage";

export default function pack_info_init() {
  PackStorage.current.ensure("/generated/pack_info.json", {
    title: "Command Blocks",
    infoItemsByLocation: [
      {
        id: "cb1",
        title: "CB 1",
        location: { x: 1, y: 71, z: 1 },
      },
      {
        id: "cb2",
        title: "CB 2",
        location: { x: 11, y: 71, z: 11 },
      },
    ],
  });
}
