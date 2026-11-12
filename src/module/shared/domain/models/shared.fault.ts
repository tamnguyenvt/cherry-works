import { ApplicationFault } from "./application.fault.js";

/**
 * What the kernel's own application service refuses, on behalf of every
 * module's use cases.
 */

/** What another module's application refused, raised again in the use case
 *  that asked it: the person's as theirs, the system's own as the system's
 *  (CORE-FR-229, SDK-FR-017). */
export class RefusedByOtherModuleFault extends ApplicationFault {}
