import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import "./HomeAppTools.css";
import { Stack, Button } from "@mui/material";
import { LocalFolderLabel } from "../shared/components/feedback/labels/Labels";
import AppServiceProxy from "../../core/AppServiceProxy";

interface IHomeAppToolsProps extends IAppProps {}

interface IHomeAppToolsState {}

export default class HomeAppTools extends Component<IHomeAppToolsProps, IHomeAppToolsState> {
  componentDidMount() {}

  private async _handleLoginClick() {
    AppServiceProxy.sendAsync("augerLogin", "");
  }

  render() {
    return (
      <div className="hat-outer">
        <div>
          <Stack direction="row" spacing={1} aria-label="Home actions">
            <Button key="openFolder" onClick={this._handleLoginClick} title="Open folder on this device">
              <LocalFolderLabel isCompact={false} />
            </Button>
          </Stack>
        </div>
      </div>
    );
  }
}
