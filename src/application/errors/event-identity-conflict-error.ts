export class EventIdentityConflictError extends Error {
  public readonly code = "EVENT_ID_CONFLICT";
  public readonly eventId: string;

  public constructor(eventId: string) {
    super(`Event ID ${eventId} was reused with different content`);

    this.name = "EventIdentityConflictError";
    this.eventId = eventId;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
