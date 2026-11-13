/**
 * SPECIFICATION — an endpoint a developer's credential may be sent to:
 * `https`, or plain `http` only to this machine, for a server under test.
 * Anything else would send it in the clear.
 *
 * Read as a URL rather than matched as text, so the host checked is the host
 * reached: `http://localhost:1@elsewhere/` is `elsewhere`.
 */
export class SecureEndpointSpec {
  isSatisfiedBy(endpoint: string): boolean {
    if (!URL.canParse(endpoint)) return false;
    const endpointURL = new URL(endpoint);
    return (
      endpointURL.protocol === "https:" ||
      (endpointURL.protocol === "http:" && ["127.0.0.1", "localhost"].includes(endpointURL.hostname))
    );
  }
}
