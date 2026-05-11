import { Component } from "react";
import Database from "../../../minecraft/Database";
import DataFormUtilities from "../../../dataform/DataFormUtilities";
import SummarizerEvaluator from "../../../dataform/SummarizerEvaluator";
import Utilities from "../../../core/Utilities";
import ItemComponentIcon, { getItemComponentColor } from "./ItemComponentIcon";
import IComponent from "../../../minecraft/IComponent";
import { getComponentDescription } from "../../../minecraft/ComponentDescriptions";
import "../entityType/EntityTypeComponentSetEditor.css";

interface IItemComponentSlotProps {
  componentId: string;
  componentData: IComponent | string | string[] | boolean | number[] | number | undefined;
  isSelected: boolean;
  title?: string;
}

interface IItemComponentSlotState {
  summaryText?: string;
}

/**
 * A component slot chip that displays an item component with its icon, name,
 * and an optional summarizer-generated description.
 */
export default class ItemComponentSlot extends Component<IItemComponentSlotProps, IItemComponentSlotState> {
  constructor(props: IItemComponentSlotProps) {
    super(props);
    this.state = {};
  }

  async componentDidMount() {
    await this.loadSummary();
  }

  async componentDidUpdate(prevProps: IItemComponentSlotProps) {
    // Compare by serialized content because ManagedComponent.setProperty
    // mutates the data object in place; reference comparison misses those
    // updates and the summary text would stay stale. See ComponentSlot.tsx
    // for the entity-flavored explanation.
    if (prevProps.componentId !== this.props.componentId) {
      await this.loadSummary();
      return;
    }
    if (this.componentDataSignature(prevProps.componentData) !== this.componentDataSignature(this.props.componentData)) {
      await this.loadSummary();
    }
  }

  private componentDataSignature(data: IItemComponentSlotProps["componentData"]): string {
    if (data === undefined || data === null) return String(data);
    if (typeof data !== "object") return typeof data + ":" + String(data);
    try {
      return JSON.stringify(data);
    } catch {
      return "obj:" + (data as any)?.constructor?.name;
    }
  }

  async loadSummary() {
    const formId = this.props.componentId.replace(/:/gi, "_").replace(/\./gi, "_");

    // Ensure form is loaded first
    await Database.ensureFormLoaded("item_components", formId);
    const form = Database.getForm("item_components", formId);

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

      // Use asSentence
      if (result.phrases.length > 0) {
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
    const humanVersion = this.props.title || Utilities.humanifyMinecraftName(componentId);
    const slotColor = getItemComponentColor(componentId);

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
              <ItemComponentIcon componentId={componentId} size={20} />
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
