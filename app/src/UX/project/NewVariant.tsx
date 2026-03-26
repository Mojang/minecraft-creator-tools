import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import Project from "../../app/Project";
import "./NewVariant.css";
import { Autocomplete, TextField, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";
import ProjectItem from "../../app/ProjectItem";
import Database from "../../minecraft/Database";
import IProjectTheme from "../types/IProjectTheme";

interface INewVariantProps extends IAppProps {
  project?: Project;
  theme: IProjectTheme;
  projectItem: ProjectItem;
  onDialogDataChange: (updateData: any) => void;
}

interface INewVariantState {
  isLoaded: boolean;
  nextVersion: string | undefined;
  newLabel: string | undefined;
  newBasedOn: string | undefined;
}

export default class NewVariant extends Component<INewVariantProps, INewVariantState> {
  constructor(props: INewVariantProps) {
    super(props);

    this._handleLabelTextChange = this._handleLabelTextChange.bind(this);
    this._handleBasedOnTextChange = this._handleBasedOnTextChange.bind(this);

    this.state = {
      isLoaded: false,
      nextVersion: undefined,
      newBasedOn: undefined,
      newLabel: undefined,
    };
  }

  componentDidMount(): void {
    this._updateManager(true);
  }

  async _updateManager(setState: boolean) {
    if (!this.state.isLoaded) {
      const nextVer = await Database.getNextMinecraftPreviewVersion();

      // Determine the default basedOn variant
      const variants = this.props.projectItem.getVariantListMostImportantFirst();
      const defaultBasedOn = variants.length > 0 ? variants[0].label : undefined;

      // Set initial dialog data so clicking OK immediately works
      if (this.props.onDialogDataChange) {
        this.props.onDialogDataChange({
          basedOn: defaultBasedOn,
          label: nextVer,
        });
      }

      if (setState) {
        this.setState({
          isLoaded: true,
          nextVersion: nextVer,
          newLabel: nextVer,
          newBasedOn: defaultBasedOn,
        });
      }
    }
  }

  _handleLabelTextChange(event: React.SyntheticEvent, value: string | null) {
    if (value) {
      this._processSeedUpdate(value, this.state.newBasedOn);
    }
  }

  _handleBasedOnTextChange(event: SelectChangeEvent<string>) {
    const value = event.target.value;
    if (value) {
      this._processSeedUpdate(this.state.newLabel, value);
    }
  }

  _processSeedUpdate(newLabel?: string, newBasedOn?: string) {
    if (this.props.onDialogDataChange) {
      this.props.onDialogDataChange({
        basedOn: newBasedOn,
        label: newLabel,
      });
    }
    this.setState({
      isLoaded: this.state.isLoaded,
      nextVersion: this.state.nextVersion,
      newBasedOn: newBasedOn,
      newLabel: newLabel,
    });
  }

  render() {
    if (this.state === null || !this.state.isLoaded) {
      return <div>Loading...</div>;
    }

    const variants = this.props.projectItem.getVariantListMostImportantFirst();
    const variantLabels: string[] = [];
    const allVariants = Object.keys(this.props.projectItem.project.variants);
    const newLabelChoices = [];

    if (this.state.nextVersion) {
      newLabelChoices.push(this.state.nextVersion);
    }

    for (const allVar of allVariants) {
      if (!this.props.projectItem.getVariant(allVar) && allVar !== this.state.nextVersion) {
        newLabelChoices.push(allVar);
      }
    }

    for (const thisVariant of variants) {
      if (thisVariant.label) {
        variantLabels.push(thisVariant.label);
      }
    }

    return (
      <div className="newvar-outer">
        <div className="newvar-options">
          <div className="newvar-variantLabel">New Variant Label</div>
          <div className="newvar-variantCombo">
            <Autocomplete
              freeSolo
              options={newLabelChoices}
              defaultValue={this.state.nextVersion}
              onChange={this._handleLabelTextChange}
              size="small"
              fullWidth
              renderInput={(params) => <TextField {...params} placeholder="Variant label" variant="outlined" />}
            />
          </div>
          <div className="newvar-basedOnLabel">Based on</div>
          <div className="newvar-basedOnDropdown">
            <FormControl fullWidth size="small">
              <Select
                defaultValue={variantLabels.length > 0 ? variantLabels[0] : ""}
                onChange={this._handleBasedOnTextChange}
              >
                {variantLabels.map((label, index) => (
                  <MenuItem key={index} value={label}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </div>
      </div>
    );
  }
}
