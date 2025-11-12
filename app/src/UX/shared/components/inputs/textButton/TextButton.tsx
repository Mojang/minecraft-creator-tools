import { Link, LinkProps } from "@mui/material";

export default function TextButton(props: LinkProps) {
  const { sx, ...other } = props;
  return (
    <Link
      sx={{
        textDecoration: "none",
        "&:hover": {
          cursor: "pointer",
          textDecoration: "underline",
        },
        ...sx,
      }}
      {...other}
    >
      {props.children}
    </Link>
  );
}
