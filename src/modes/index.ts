import { diceMode } from "./dice";
import { cardMode } from "./cards";
import { coordinateMode } from "./coordinates";
import { timeCapsuleMode } from "./timecapsule";
import { numberMode } from "./number";
import { letterMode } from "./letters";

export const MODES = {
  number: numberMode,
  letters: letterMode,
  dice: diceMode,
  cards: cardMode,
  coordinates: coordinateMode,
  timecapsule: timeCapsuleMode,
} as const;

export type ModeId = keyof typeof MODES;
