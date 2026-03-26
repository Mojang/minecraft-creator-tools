import PackStorage from "../../files/PackStorage";

export default function action_idle_form_init() {
  PackStorage.current.ensure("/forms/action_idle.form.json", {
    title: "Idle",
    fields: [
      {
        id: "idle",
        title: "Ticks",
        dataType: 2,
      },
    ],
  });
}
