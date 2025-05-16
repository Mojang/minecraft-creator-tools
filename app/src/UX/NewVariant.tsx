import { Component } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./NewVariant.css";
import { DropdownProps, FormDropdown, ThemeInput } from "@fluentui/react-northstar";
import ProjectItem from "../app/ProjectItem";
import Database from "../minecraft/Database";

interface INewVariantProps extends IAppProps {
  project?: Project;
  theme: ThemeInput<any>;
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

      if (setState) {
        this.setState({
          isLoaded: true,
          nextVersion: nextVer,
        });
      }
    }
  }

  _handleLabelTextChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps | undefined
  ) {
    if (data && data.value) {
      this._processSeedUpdate((data as any).value, this.state.newBasedOn);
    }
  }

  _handleBasedOnTextChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps | undefined
  ) {
    if (data && data.value) {
      this._processSeedUpdate(this.state.newLabel, data.value as any);
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
      nextVersion: this.state.newLabel,
      newBasedOn: this.state.newBasedOn,
      newLabel: this.state.newLabel,
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
      if (!this.props.projectItem.variants[allVar] && allVar !== this.state.nextVersion) {
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
            <FormDropdown
              search={true}
              activeSelectedIndex={0}
              items={newLabelChoices}
              defaultSearchQuery={this.state.nextVersion}
              key={"frsA"}
              fluid={true}
              onChange={this._handleLabelTextChange}
            />
          </div>
          <div className="newvar-basedOnLabel">Based on</div>
          <div className="newvar-basedOnDropdown">
            <FormDropdown
              activeSelectedIndex={0}
              items={variantLabels}
              key={"frsB"}
              fluid={true}
              onChange={this._handleBasedOnTextChange}
            />
          </div>
        </div>
      </div>
    );
  }
}
