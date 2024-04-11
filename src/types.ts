export interface Options {
  // base path of session data
  basePath: string;
  // user session table path
  tablePath: string;
  // expiration in seconds
  expires: number;
}

export type WithBaseAttributes<R> = {
  // reference to firestore
  userId: string;
  // session time to live in milliseconds
  TTL: string;
} & R;
