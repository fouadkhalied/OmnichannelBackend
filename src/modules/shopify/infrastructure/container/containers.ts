// infrastructure/container.ts  ← one place wires everything
import { InMemoryEventPublisher } from "../../application/ports/IEventPublisher";
import { PgSyncJobRepository } from "../postgres/repositories/PgSyncJobRepository";

export const container = {
    syncJobRepository: new PgSyncJobRepository(),
    eventPublisher: new InMemoryEventPublisher(),
};