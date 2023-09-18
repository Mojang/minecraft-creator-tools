import Block from "./Block";

export default interface IBlockSurroundings {
  left?: Block;
  right?: Block;
  forward?: Block;
  backward?: Block;
  up?: Block;
  down?: Block;
}
