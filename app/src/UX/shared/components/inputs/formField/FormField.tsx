import { TextField, TextFieldProps } from "@mui/material";

// coalesces common props for fields used in forms, while allowing overrides
export default function FormField(props: TextFieldProps) {
  return (
    <TextField
      fullWidth
      margin="dense"
      variant="standard"
      color="secondary"
      id={props.id}
      name={props.id}
      type="text"
      {...props}
    />
  );
}
