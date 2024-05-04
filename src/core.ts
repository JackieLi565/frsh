import { Database } from "firebase-admin/database";
import { Options, WithBaseAttributes } from "./types.js";

const twoHours = 60 * 60 * 2;

export default class Frsh<SessionRecord> {
  private adaptor: Database;
  private opt: Options;

  public constructor(db: Database, opts?: Partial<Options>) {
    const defaultOptions: Options = {
      sessionPath: "/sessions",
      tablePath: "/session-table",
      expires: twoHours,
    };

    this.adaptor = db;
    if (!opts) {
      this.opt = defaultOptions;
    } else {
      this.opt = { ...defaultOptions, ...opts };
    }
  }

  public async createSession(
    userId: string,
    record?: SessionRecord
  ): Promise<string | undefined> {
    const sessionRef = this.adaptor.ref(this.opt.sessionPath);
    const tableRef = this.adaptor.ref(this.tableRef(userId));

    const sessionRecord = {
      TTL: Date.now() + this.opt.expires * 1000,
      userId,
      ...record,
    };

    const res = await sessionRef.push(sessionRecord);

    if (!res.key) return undefined;

    await tableRef.update({
      [res.key]: sessionRecord.TTL,
    });

    return res.key;
  }

  public async getSession(
    sessionId: string
  ): Promise<WithBaseAttributes<SessionRecord> | undefined> {
    const sessionRef = this.adaptor.ref(this.sessionRef(sessionId));
    const snapshot = await sessionRef.once("value");
    const sessionData = snapshot.val();
    return sessionData
      ? (sessionData as WithBaseAttributes<SessionRecord>)
      : undefined;
  }

  public async removeSession(userId: string, sessionId: string): Promise<void> {
    const tableRef = this.adaptor.ref(this.tableSessionRef(userId, sessionId));
    const sessionRef = this.adaptor.ref(this.sessionRef(sessionId));

    await Promise.all([tableRef.remove, sessionRef.remove]);
  }

  // helpers
  private tableRef(userId: string) {
    return `${this.opt.tablePath}/${userId}`;
  }

  private tableSessionRef(userId: string, sessionId: string) {
    return `${this.opt.tablePath}/${userId}/${sessionId}`;
  }

  private sessionRef(sessionId: string) {
    return `${this.opt.sessionPath}/${sessionId}`;
  }
}
