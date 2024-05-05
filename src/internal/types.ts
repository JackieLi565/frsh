import { BaseAttributes } from "../types.js";

export type SessionRef = {
  [sessionId: string]: BaseAttributes;
};

export type TableRef = {
  [userId: string]: {
    // expire time value
    [sessionId: string]: number;
  };
};
