import { Box, Paper } from "@mui/material";
import CreatorToolsHost from "../../../app/CreatorToolsHost";
import { useIntl } from "react-intl";

export default function HeroBanner() {
  const intl = useIntl();
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
            maxHeight="10em"
            sx={{
              width: "100%",
              borderRadius: 0,
              backgroundImage: `url("${CreatorToolsHost.contentWebRoot}res/images/home/HeroBanner_380bg.jpg")`,
              backgroundSize: "contain",
              backgroundRepeat: "repeat-x",
            }}
          >
            <Box
              component="img"
              role="img"
              src={CreatorToolsHost.contentWebRoot + "res/images/home/HeroBanner.jpg"}
              alt={intl.formatMessage({ id: "home.hero.banner_alt" })}
              aria-hidden="true"
              maxHeight="10em"
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
