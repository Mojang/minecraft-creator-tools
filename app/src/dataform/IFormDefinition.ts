import IField from "./IField";

export default interface IFormDefinition {
  id: string;
  title?: string;
  description?: string;
  fields: IField[];
}
