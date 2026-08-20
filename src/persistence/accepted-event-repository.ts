import type { Pool } from "pg";

import type { OperationalEvent } from "../events/operational-event.js";

interface AcceptedEventRow {
  replay_sequence: string;
  event_id: string;
  event_fingerprint: string;
  event_data: OperationalEvent;
  accepted_at: Date;
}

export interface AcceptedEventRecord {
  replaySequence: string;
  eventId: string;
  eventFingerprint: string;
  eventData: OperationalEvent;
  acceptedAt: string;
}

export type InsertAcceptedEventResult =
  | {
      status: "INSERTED";
      event: AcceptedEventRecord;
    }
  | {
      status: "EXISTING";
      event: AcceptedEventRecord;
    };

export class AcceptedEventRepository {
  public constructor(private readonly pool: Pool) {}

  public async insertOrGet(
    event: OperationalEvent,
    fingerprint: string,
  ): Promise<InsertAcceptedEventResult> {
    const inserted = await this.pool.query<AcceptedEventRow>(
      `
        INSERT INTO accepted_events (
          event_id,
          event_fingerprint,
          event_data
        )
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (event_id) DO NOTHING
        RETURNING
          replay_sequence,
          event_id,
          event_fingerprint,
          event_data,
          accepted_at
      `,
      [event.eventId, fingerprint, JSON.stringify(event)],
    );

    const insertedRow = inserted.rows[0];

    if (insertedRow !== undefined) {
      return {
        status: "INSERTED",
        event: mapAcceptedEventRow(insertedRow),
      };
    }

    const existing = await this.pool.query<AcceptedEventRow>(
      `
        SELECT
          replay_sequence,
          event_id,
          event_fingerprint,
          event_data,
          accepted_at
        FROM accepted_events
        WHERE event_id = $1
      `,
      [event.eventId],
    );

    const existingRow = existing.rows[0];

    if (existingRow === undefined) {
      throw new Error(
        `Accepted event ${event.eventId} disappeared after an insertion conflict`,
      );
    }

    return {
      status: "EXISTING",
      event: mapAcceptedEventRow(existingRow),
    };
  }

  public async findByEventId(
    eventId: string,
  ): Promise<AcceptedEventRecord | null> {
    const result = await this.pool.query<AcceptedEventRow>(
      `
        SELECT
          replay_sequence,
          event_id,
          event_fingerprint,
          event_data,
          accepted_at
        FROM accepted_events
        WHERE event_id = $1
      `,
      [eventId],
    );

    const row = result.rows[0];

    return row === undefined ? null : mapAcceptedEventRow(row);
  }

  public async listForReplay(): Promise<AcceptedEventRecord[]> {
    const result = await this.pool.query<AcceptedEventRow>(
      `
        SELECT
          replay_sequence,
          event_id,
          event_fingerprint,
          event_data,
          accepted_at
        FROM accepted_events
        ORDER BY replay_sequence ASC
      `,
    );

    return result.rows.map(mapAcceptedEventRow);
  }
}

function mapAcceptedEventRow(row: AcceptedEventRow): AcceptedEventRecord {
  return {
    replaySequence: row.replay_sequence,
    eventId: row.event_id,
    eventFingerprint: row.event_fingerprint,
    eventData: row.event_data,
    acceptedAt: row.accepted_at.toISOString(),
  };
}
