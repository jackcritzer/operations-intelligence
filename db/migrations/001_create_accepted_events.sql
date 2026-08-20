CREATE TABLE accepted_events (
    replay_sequence BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    event_fingerprint TEXT NOT NULL,
    event_data JSONB NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT accepted_events_event_id_not_blank
        CHECK (btrim(event_id) <> ''),

    CONSTRAINT accepted_events_fingerprint_not_blank
        CHECK (btrim(event_fingerprint) <> ''),

    CONSTRAINT accepted_events_event_data_is_object
        CHECK (jsonb_typeof(event_data) = 'object')
);