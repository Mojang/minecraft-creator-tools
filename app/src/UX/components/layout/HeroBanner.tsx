import { Box, Paper } from "@mui/material";

export default function HeroBanner() {
  return (
    <Box sx={{ position: "relative" }}>
      <Paper
        elevation={3}
        sx={{
          p: 0,
          mb: 4,
          textAlign: "center",
          borderRadius: 0,
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: "inline-block",
            overflow: "none",
            width: "100%",
            backgroundColor: "background.default",
          }}
        >
          <Box
            component="div"
            aria-hidden="true"
            maxHeight="16em"
            sx={{
              width: "100%",
              borderRadius: 0,
              backgroundImage: `url("./res/images/home/HeroBanner_380bg.jpg")`,
              backgroundSize: "contain",
              backgroundRepeat: "repeat-x",
            }}
          >
            <Box
              component="img"
              role="img"
              src="./res/images/home/HeroBanner.jpg"
              alt="Create and Edit Your Own Minecraft Add-Ons Banner"
              aria-hidden="true"
              maxHeight="16em"
              sx={{
                maxWidth: "100%",
              }}
            />
          </Box>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          ></Box>
        </Box>
      </Paper>
    </Box>
  );
}
