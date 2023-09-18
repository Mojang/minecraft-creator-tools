import Location from "../Location";

export default interface ISeat {
  position: Location;
  minRiderCount: number;
  maxRiderCount: number;
  rotateRiderBy: number;
  lockRiderRotation: number;
}
