export interface DataUxColumn {
  name: string;
  header?: string;
  sortable?: boolean;
  resizable?: boolean;
  width?: number | "auto";
  filter?: {
    type: "text" | "date" | "number";
  };
}
