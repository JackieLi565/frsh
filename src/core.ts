import { Database } from "firebase-admin/database";
import { Options, WithBaseAttributes } from "./types.js";

export default class Frsh<SessionRecord> {
  private firebaseRTDB: Database;
  private opt: Options;
  public constructor(db: Database, opts?: Options) {
    this.firebaseRTDB = db;

    if (opts) {
      this.opt = opts;
    } else {
      this.opt = {
        basePath: "/",
        tablePath: "/",
        expires: 60 * 60 * 2,
      };
    }
  }

  public async createSession(
    userId: string,
    record: SessionRecord
  ): Promise<string | undefined> {
    const sessionRef = this.firebaseRTDB.ref(this.opt.basePath);
    const tableRef = this.firebaseRTDB.ref(`${this.opt.tablePath}/${userId}`);

    const res = await sessionRef.push(this.createSessionRecord(userId, record));

    if (!res.key) return undefined;

    await tableRef.update({
      [res.key]: Date.now(),
    });

    return this.encrypt(res.key);
  }

  public async getSession(
    hash: string
  ): Promise<WithBaseAttributes<SessionRecord> | null> {
    const id = this.decrypt(hash);
    const ref = this.firebaseRTDB.ref(`${this.opt.basePath}/${id}`);
    const snapshot = await ref.once("value");
    return snapshot.val() as WithBaseAttributes<SessionRecord>;
  }

  public async deleteSession(hash: string) {
    const id = this.decrypt(hash);
    const ref = this.firebaseRTDB.ref(`${this.opt.basePath}/${id}`);

    await ref.remove();
  }

  public async deleteUserSession(userId: string, hash: string) {
    const id = this.decrypt(hash);
    const tableRef = this.firebaseRTDB.ref(
      `${this.opt.tablePath}/${userId}/${id}`
    );
    const sessionRef = this.firebaseRTDB.ref(`${this.opt.basePath}/${id}`);

    await Promise.all([tableRef.remove, sessionRef.remove]);
  }

  // TODO: encrypt session
  private encrypt(id: string): string {
    return id;
  }

  // TODO: decrypt session
  private decrypt(hash: string): string {
    return hash;
  }

  private createSessionRecord(userId: string, record: SessionRecord) {
    let sessionRecord = {};
    if (record) {
      sessionRecord = {
        TTL: Date.now() + this.opt.expires * 1000,
        userId,
        ...record,
      };
    } else {
      sessionRecord = {
        TTL: Date.now() + this.opt.expires * 1000,
        userId,
      };
    }

    return sessionRecord;
  }
}
