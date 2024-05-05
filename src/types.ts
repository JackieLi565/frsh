export interface Options {
  // base path of session data
  sessionPath: string;
  // user session table path
  tablePath: string;
  // expiration in seconds
  expires: number;
}

export type BaseAttributes = {
  // reference to firestore
  userId: string;
  // session time to live in milliseconds
  TTL: number;
};

export type WithBaseAttributes<R = {}> = BaseAttributes & R;
