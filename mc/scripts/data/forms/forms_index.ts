import PackStorage from "../../files/PackStorage";
import action_entity_spawn_form_init from "./action_entity_spawn.form";
import action_idle_form_init from "./action_idle.form";
import action_simulatedplayer_move_init from "./action_simulatedplayer_move.form";
import action_simulatedplayer_spawn_form_init from "./action_simulatedplayer_spawn.form";

export default function forms_index_init() {
  let folder = PackStorage.current.ensureFolder("forms");

  action_entity_spawn_form_init();
  action_idle_form_init();
  action_simulatedplayer_move_init();
  action_simulatedplayer_spawn_form_init();
}
