export default interface IPlayerTravelledEvent {
  eventId?: string;
  header: {
    eventName: string;
    purpose: string;
    version: number;
  };
  body: {
    isUnderwater: boolean;
    metersTravelled: number;
    newBiome: number;
    player: {
      color: string;
      dimension: number;
      id: number;
      name: string;
      position: {
        x: number;
        y: number;
        z: number;
      };
      type: string;
      variant: number;
      yRot: number;
    };
    travelMethod: number;
  };
}
