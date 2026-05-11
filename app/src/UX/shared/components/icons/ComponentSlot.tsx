import { Component } from "react";
import Database from "../../../../minecraft/Database";
import DataFormUtilities from "../../../../dataform/DataFormUtilities";
import SummarizerEvaluator from "../../../../dataform/SummarizerEvaluator";
import Utilities from "../../../../core/Utilities";
import ComponentIcon, { getComponentColor } from "./ComponentIcon";
import { getEntityFriendlyName } from "../../../utils/ComponentFriendlyNames";
import IComponent from "../../../../minecraft/IComponent";
import { getComponentDescription } from "../../../../minecraft/ComponentDescriptions";
import "../../../editors/entityType/EntityTypeComponentSetEditor.css";

interface IComponentSlotProps {
  componentId: string;
  componentData: IComponent | string | string[] | boolean | number[] | number | undefined;
  isSelected: boolean;
  title?: string;
}

interface IComponentSlotState {
  summaryText?: string;
}

/**
 * A component slot chip that displays a component with its icon, name,
 * and an optional summarizer-generated description.
 */
export default class ComponentSlot extends Component<IComponentSlotProps, IComponentSlotState> {
  constructor(props: IComponentSlotProps) {
    super(props);
    this.state = {};
  }

  async componentDidMount() {
    await this.loadSummary();
  }

  async componentDidUpdate(prevProps: IComponentSlotProps) {
    // We compare data by serialized content rather than reference because
    // ManagedComponent.setProperty mutates the underlying object in place
    // (see app/src/minecraft/ManagedComponent.ts setProperty). Reference
    // comparison would miss those mutations and the summary would stay
    // stale — producing prose that contradicts the toggles right next to
    // it.
    if (prevProps.componentId !== this.props.componentId) {
      await this.loadSummary();
      return;
    }
    if (this.componentDataSignature(prevProps.componentData) !== this.componentDataSignature(this.props.componentData)) {
      await this.loadSummary();
    }
  }

  private componentDataSignature(data: IComponentSlotProps["componentData"]): string {
    if (data === undefined || data === null) return String(data);
    if (typeof data !== "object") return typeof data + ":" + String(data);
    try {
      return JSON.stringify(data);
    } catch {
      // Fall back to identity if data has cycles
      return "obj:" + (data as any)?.constructor?.name;
    }
  }

  async loadSummary() {
    const formId = this.props.componentId.replace(/:/gi, "_").replace(/\./gi, "_");
    const form = Database.getForm("entity", formId);

    // Only try to summarize if we have an object (not a primitive) for componentData
    const data = this.props.componentData;
    if (!form || !data || typeof data !== "object") {
      this.setState({ summaryText: undefined });
      return;
    }

    try {
      // Prefer inline summarizer on the form, fall back to summarizerId reference
      let summarizer = form.summarizer;
      if (!summarizer && form.summarizerId) {
        summarizer = await DataFormUtilities.loadSummarizerById(form.summarizerId);
      }

      if (!summarizer) {
        this.setState({ summaryText: undefined });
        return;
      }

      const evaluator = new SummarizerEvaluator();
      const result = evaluator.evaluate(summarizer, data as object, form);

      // Use asSentence without the "This entity" prefix
      if (result.phrases.length > 0) {
        // Capitalize first letter of the first phrase
        let text = result.asSentence;
        if (text.length > 0) {
          text = text.charAt(0).toUpperCase() + text.slice(1);
        }
        this.setState({ summaryText: text });
      } else {
        this.setState({ summaryText: undefined });
      }
    } catch (e) {
      this.setState({ summaryText: undefined });
    }
  }

  render() {
    const { componentId, isSelected } = this.props;
    const friendlyName = getEntityFriendlyName(componentId);
    const humanVersion = this.props.title || friendlyName || Utilities.humanifyMinecraftName(componentId);
    const slotColor = getComponentColor(componentId);

    return (
      <div
        className={`etcse-componentSlot ${isSelected ? "etcse-slotSelected" : ""}`}
        style={
          {
            "--slot-color": slotColor,
          } as React.CSSProperties
        }
        data-tooltip={humanVersion}
        title={getComponentDescription(componentId) || humanVersion}
      >
        <div className="etcse-slotChip">
          <div className="etcse-slotChipHeader">
            <div className="etcse-slotIcon">
              <ComponentIcon componentId={componentId} size={20} />
            </div>
            <div className="etcse-slotLabel">
              <span className="etcse-slotText">{humanVersion}</span>
            </div>
          </div>
          {this.state.summaryText && (
            <div className="etcse-slotSummary" title={this.state.summaryText}>
              {this.state.summaryText.length > 80
                ? this.state.summaryText.substring(0, 80) + "…"
                : this.state.summaryText}
            </div>
          )}
        </div>
      </div>
    );
  }
}
