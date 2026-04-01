import PackStorage from "../../files/PackStorage";

export default function action_simulatedplayer_spawn_form_init() {
  PackStorage.current.ensure("/forms/action_simulatedplayer_spawn.form.json", {
    title: "Spawn Entity",
    fields: [
      {
        id: "location",
        title: "Location",
        dataType: 11,
      },
    ],
  });
}
