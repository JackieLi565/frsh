import { Database } from "firebase-admin/database";
import { Options, WithBaseAttributes } from "./types.js";

const twoHours = 60 * 60 * 2;

export default class Frsh<SessionRecord> {
  private firebaseRTDB: Database;
  private opt: Options;

  public constructor(
    db: Database,
    opts: Options = {
      basePath: "/sessions",
      tablePath: "/session-table",
      expires: twoHours,
    }
  ) {
    this.firebaseRTDB = db;

    this.opt = opts;
  }

  /**
   *
   * @param userId user database id
   * @param record external record attributes
   * @returns session key
   */
  public async createSession(
    userId: string,
    record?: SessionRecord
  ): Promise<string | undefined> {
    const sessionRef = this.firebaseRTDB.ref(this.opt.basePath);
    const tableRef = this.firebaseRTDB.ref(`${this.opt.tablePath}/${userId}`);

    const sessionRecord = this.createSessionRecord(userId, record);
    const res = await sessionRef.push(sessionRecord);

    if (!res.key) return undefined;

    await tableRef.update({
      [res.key]: sessionRecord.TTL,
    });

    return res.key;
  }

  /**
   *
   * @param sessionId sessionId
   * @returns session data
   */
  public async getSession(
    sessionId: string
  ): Promise<WithBaseAttributes<SessionRecord> | undefined> {
    const ref = this.firebaseRTDB.ref(`${this.opt.basePath}/${sessionId}`);
    const snapshot = await ref.once("value");
    return snapshot.val() as WithBaseAttributes<SessionRecord>;
  }

  /**
   *
   * @param sessionId sessionId
   */
  public async removeSession(sessionId: string): Promise<void> {
    const ref = this.firebaseRTDB.ref(`${this.opt.basePath}/${sessionId}`);
    await ref.remove();
  }

  /**
   *
   * @param userId user database id
   * @param sessionId sessionId
   */
  public async removeUserSession(
    userId: string,
    sessionId: string
  ): Promise<void> {
    const tableRef = this.firebaseRTDB.ref(
      `${this.opt.tablePath}/${userId}/${sessionId}`
    );
    const sessionRef = this.firebaseRTDB.ref(
      `${this.opt.basePath}/${sessionId}`
    );

    await Promise.all([tableRef.remove, sessionRef.remove]);
  }

  //TODO: batch instructions
  public async removeExpiredSessions(batch: number) {}

  private createSessionRecord(userId: string, record?: SessionRecord) {
    return {
      TTL: Date.now() + this.opt.expires * 1000,
      userId,
      ...record,
    };
  }
}
