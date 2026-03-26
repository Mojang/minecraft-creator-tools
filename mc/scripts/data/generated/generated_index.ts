import PackStorage from "../../files/PackStorage";
import pack_info_init from "./pack_info";

export default function generated_index_init() {
  let folder = PackStorage.current.ensureFolder("generated");
  pack_info_init();
}
