import { DomainFault } from "./domain.fault.js";

/**
 * What a use case refuses, whatever the domain and the adapters say. The base of every
 * module's own, each kept in its module's `domain/models/<module>.fault.ts`:
 * a class of its own where a driver tells it apart, by the `name` its fault
 * DTO carries, never by the class.
 */
export class ApplicationFault extends DomainFault {}
