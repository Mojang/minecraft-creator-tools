export interface Item {
  count: number;
  damage: number;
  name: string;
  wasPickedUp: boolean;
}

export interface InventoryItem extends Item {
  slot: number;
}
