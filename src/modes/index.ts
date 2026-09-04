import { diceMode } from "./dice";
import { cardMode } from "./cards";
import { coordinateMode } from "./coordinates";
import { timeCapsuleMode } from "./timecapsule";

// Number and Letter mode engines from the original spec plug in here the same way:
// import { numberMode } from "./number";
// import { letterMode } from "./letters";

export const MODES = {
  dice: diceMode,
  cards: cardMode,
  coordinates: coordinateMode,
  timecapsule: timeCapsuleMode,
} as const;

export type ModeId = keyof typeof MODES;
