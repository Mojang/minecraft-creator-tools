import PackStorage from "../../files/PackStorage";

export default function action_simulatedplayer_move_init() {
  PackStorage.current.ensure("/forms/action_simulatedplayer_move.form.json", {
    title: "Move Entity",
    fields: [
      {
        id: "location",
        title: "Location",
        dataType: 11,
      },
    ],
  });
}
