import PackStorage from "../../files/PackStorage";

export default function action_entity_spawn_form_init() {
  PackStorage.current.ensure("/forms/action_entity_spawn.form.json", {
    title: "Spawn Entity",
    fields: [
      {
        id: "location",
        title: "Location",
        dataType: 11,
      },
      {
        id: "entityType",
        title: "Entity Type",
        dataType: 2,
      },
    ],
  });
}
