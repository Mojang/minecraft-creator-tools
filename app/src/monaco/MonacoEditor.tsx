import React, { Component } from "react";
import * as monaco from "monaco-editor";
/*
(window as any).MonacoEnvironment = {
	getWorkerUrl: function (workerId, label) {
		return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
			self.MonacoEnvironment = { baseUrl: '${window.location.origin}/' };
			importScripts('${window.location.origin}/vs/base/worker/workerMain.js');
		`)}`;
	}
	window.self.MonacoEnvironment = {
	baseUrl: encodeURIComponent(window.location.origin),
	getWorkerUrl: function (_moduleId: any, label: string) {
		if (label === 'json') {
			return './json.worker.bundle.js';
		}
		if (label === 'css' || label === 'scss' || label === 'less') {
			return './css.worker.bundle.js';
		}
		if (label === 'html' || label === 'handlebars' || label === 'razor') {
			return './html.worker.bundle.js';
		}
		if (label === 'typescript' || label === 'javascript') {
			return './ts.worker.bundle.js';
		}
		return './editor.worker.bundle.js';
	}
};

window.self.MonacoEnvironment = {
	baseUrl: encodeURIComponent(window.location.origin + "/dist/vs/"),
	getWorkerUrl: function (_moduleId: any, label: string) {
		if (label === 'json') {
			return '/dist/vs/language/tsWorker.js';
		}
		if (label === 'css' || label === 'scss' || label === 'less') {
			return './css.worker.bundle.js';
		}
		if (label === 'html' || label === 'handlebars' || label === 'razor') {
			return './html.worker.bundle.js';
		}
		if (label === 'typescript' || label === 'javascript') {
			return '/dist/vs/language/tsWorker.js';
		}
		return './editor.worker.bundle.js';
	}

};

};*/

// @ts-ignore
window.self.MonacoEnvironment = {
  baseUrl: encodeURIComponent(window.location.origin),
  getWorkerUrl: function (_moduleId: any, label: string) {
    if (label === "json") {
      return "./json.worker.bundle.js";
    }
    if (label === "css" || label === "scss" || label === "less") {
      return "./css.worker.bundle.js";
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return "./html.worker.bundle.js";
    }
    if (label === "typescript" || label === "javascript") {
      return "./ts.worker.bundle.js";
    }
    return "./editor.worker.bundle.js";
  },
};

interface IMonacoEditorProps {
  contentId: string;
  initialContent: string;
  onContentUpdated?: (newContent: string) => void;
}

interface IMonacoEditorState {
  contentId: string;
  content: string;
  updateEditorValueNext: boolean;
}

export default class MonacoEditor extends Component<IMonacoEditorProps, IMonacoEditorState> {
  _editorOuterDiv: HTMLDivElement | null;
  _editorDiv: HTMLDivElement | null;
  _editor: monaco.editor.IStandaloneCodeEditor | null;
  _lastContentId: string;
  _viewStates: { [id: string]: monaco.editor.ICodeEditorViewState };

  constructor(props: IMonacoEditorProps) {
    super(props);

    this._doResize = this._doResize.bind(this);
    this._handleContentChange = this._handleContentChange.bind(this);

    this._editorOuterDiv = null;
    this._editorDiv = null;
    this._editor = null;

    this._viewStates = {};

    window.addEventListener("resize", this._doResize);

    this.state = {
      contentId: "____",
      content: "<placeholder>",
      updateEditorValueNext: false,
    };

    this._lastContentId = this.state.contentId;
  }

  private _doResize() {
    if (this._editor != null && this._editorDiv != null) {
      let elt: HTMLElement = this._editorDiv;

      if (elt.parentElement != null && elt.parentElement != null) {
        elt = elt.parentElement.parentElement as HTMLElement;

        this._editor.layout({
          width: elt.clientWidth,
          height: elt.clientHeight,
        } as monaco.editor.IDimension);
      }
    }
  }

  static getDerivedStateFromProps(props: IMonacoEditorProps, state: IMonacoEditorState) {
    if (
      props.initialContent !== null &&
      props.initialContent !== state.content &&
      props.contentId !== state.contentId
    ) {
      state.contentId = props.contentId;
      state.content = props.initialContent;
      state.updateEditorValueNext = true;

      return state;
    }

    return null; // No change to state
  }

  componentWillUnmount() {
    if (this._editor != null) {
      this._editor.dispose();
      this._editor = null;
    }

    this._editorDiv = null;
    this._editorOuterDiv = null;
  }

  componentDidUpdate(prevProps: IMonacoEditorProps, prevState: IMonacoEditorState) {
    if (this._editor !== null && this.state.updateEditorValueNext) {
      if (this._lastContentId !== this.state.contentId) {
        this._preserveViewState(this._lastContentId);
      }

      this._lastContentId = this.state.contentId;

      this._editor.setValue(this.state.content);

      const viewState = this._viewStates[this.state.contentId];

      if (viewState != null) {
        this._editor.restoreViewState(viewState);
      }
    }
  }

  _handleContentChange(event: monaco.editor.IModelContentChangedEvent) {
    this._save();
  }

  _save() {
    if (this._editor !== null) {
      const val = this._editor.getValue();

      if (val !== this.state.content) {
        this._preserveViewState(this.state.contentId);

        if (this.props.onContentUpdated != null) {
          this.props.onContentUpdated(val);
        }

        this.setState({
          contentId: this.state.contentId,
          content: val,
          updateEditorValueNext: false,
        });
      }
    }
  }

  _preserveViewState(contentId: string) {
    if (this._editor != null) {
      const viewState = this._editor.saveViewState();

      if (viewState != null) {
        this._viewStates[contentId] = viewState;
      }
    }
  }

  _setEditor(elt: HTMLDivElement) {
    if (elt !== null && elt !== this._editorOuterDiv) {
      if (this._editorDiv == null) {
        this._editorDiv = document.createElement("DIV") as HTMLDivElement;

        //				this._editorDiv.addEventListener("resize", this._doResize);
        /*
				const eltParent = elt.parentElement;

				if (eltParent != null)
				{
					eltParent = elt.parentElement;
					if (eltParent != null)
					{
						eltParent.addEventListener("resize", this._doResize);
					}
				}
*/
        this._editorDiv.setAttribute(
          "style",
          "width: 100%; height: 100%; min-width: 100%; min-height: 100%; background-color: purple"
        );
      } else if (this._editorOuterDiv != null) {
        this._editorOuterDiv.removeChild(this._editorDiv);
      }

      elt.appendChild(this._editorDiv);

      this._editorOuterDiv = elt;

      if (this._editor == null) {
        this._editor = monaco.editor.create(this._editorDiv, {
          value: this.state.content,
          theme: "vs-dark",
          automaticLayout: false,
          language: "javascript",
        });

        this._editor.onDidChangeModelContent(this._handleContentChange);
      }

      this._doResize();
    }
  }

  render() {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minWidth: "100%",
          minHeight: "100%",
          textAlign: "left",
        }}
        ref={(c: HTMLDivElement) => this._setEditor(c)}
      />
    );
  }
}
