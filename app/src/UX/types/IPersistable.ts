export default interface IPersistable {
  persist(): Promise<boolean>;
}
