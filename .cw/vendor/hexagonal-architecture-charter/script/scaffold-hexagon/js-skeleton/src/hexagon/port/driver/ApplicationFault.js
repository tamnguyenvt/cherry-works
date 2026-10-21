import { DomainFault } from "../../domain/models/DomainFault.js";

/**
 * APPLICATION FAULT — what a use case refuses, whatever the domain and the
 * adapters say. Add the use cases' faults here, each extending it.
 */
export class ApplicationFault extends DomainFault {}
