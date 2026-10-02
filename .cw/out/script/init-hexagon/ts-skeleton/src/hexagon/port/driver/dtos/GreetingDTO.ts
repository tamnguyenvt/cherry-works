/** What a driver reads of a greeting: plain data, ready to print or to send
 *  as JSON. It knows no model; the application builds it. */
export interface GreetingDTO {
  readonly text: string;
}
