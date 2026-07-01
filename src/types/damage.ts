export interface DamageInput {
  inventoryId: number;
  damageType: "piece" | "pack_open";
  quantity: number; 
  reason?: "leakage" | "expired" | "breakage" | "theft" | "other";
}