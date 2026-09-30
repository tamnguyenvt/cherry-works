import { z } from "zod";

/**
 * What every DTO is written with, data or outcome, written once: the shape of
 * one, how a set of them is keyed, and the list of StringsSchema many of them hold.
 */

/** A list of names, paths or globs. */
export const StringsSchema = z.array(z.string()).readonly();

/** One DTO: its model's name, and what it holds. Every DTO is written with
 *  this, so each is `{ type, data }` the same way. */
export const dto = <const Type extends string, Data extends z.ZodType>(type: Type, data: Data) =>
  z.object({ type: z.literal(type), data });

/** What `byType` is handed: a DTO's schema, read for the `type` it carries. */
type DTOSchema = { readonly shape: { readonly type: { readonly value: string } } };

/** Those schemas, each under the `type` it carries. */
type ByType<Schemas extends readonly DTOSchema[]> = {
  [Schema in Schemas[number] as Schema["shape"]["type"]["value"]]: Schema;
};

/** Every schema under the `type` it carries: the key a DTO is looked up by is
 *  read off the schema rather than written beside it, so the two cannot drift
 *  apart. */
export function byType<const Schemas extends readonly DTOSchema[]>(...schemas: Schemas): ByType<Schemas> {
  return Object.fromEntries(schemas.map((one) => [one.shape.type.value, one])) as ByType<Schemas>;
}
