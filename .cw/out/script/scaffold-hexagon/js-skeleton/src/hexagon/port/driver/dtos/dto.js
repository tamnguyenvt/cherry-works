import { z } from "zod";

/**
 * What every DTO is written with, written once: the shape of one, and how a
 * set of them is keyed.
 */

/**
 * What `byType` is handed: a DTO's schema, read for the `type` it carries.
 * @typedef {{ readonly shape: { readonly type: { readonly value: string } } }} DTOSchema
 */

/**
 * Those schemas, each under the `type` it carries.
 * @template {readonly DTOSchema[]} Schemas
 * @typedef {{ [Schema in Schemas[number] as Schema["shape"]["type"]["value"]]: Schema }} ByType
 */

/**
 * One DTO: its model's name, and what it holds. Every DTO is written with
 * this, so each is `{ type, data }` the same way.
 * @type {<const Type extends string, Data extends z.ZodType>(type: Type, data: Data) => z.ZodObject<{ type: z.ZodLiteral<Type>, data: Data }>}
 */
export const dto = (type, data) => z.object({ type: z.literal(type), data });

/**
 * Every schema under the `type` it carries: the key a DTO is looked up by is
 * read off the schema rather than written beside it, so the two cannot drift
 * apart.
 * @type {<const Schemas extends readonly DTOSchema[]>(...schemas: Schemas) => ByType<Schemas>}
 */
export const byType = (...schemas) =>
  /** @type {any} */ (Object.fromEntries(schemas.map((schema) => [schema.shape.type.value, schema])));
