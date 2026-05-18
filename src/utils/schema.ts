type Schema = Record<string, any>;
type OptionalSchema = Schema & { __optional?: true };

function clean(schema: OptionalSchema): Schema {
  const { __optional, ...rest } = schema;
  return rest;
}

export const Type = {
  Object(properties: Record<string, OptionalSchema> = {}, options: Schema = {}): Schema {
    const required = Object.entries(properties)
      .filter(([, schema]) => !schema.__optional)
      .map(([key]) => key);

    const cleanProperties = Object.fromEntries(
      Object.entries(properties).map(([key, schema]) => [key, clean(schema)])
    );

    return {
      type: 'object',
      properties: cleanProperties,
      ...(required.length > 0 ? { required } : {}),
      ...options
    };
  },

  String(options: Schema = {}): Schema {
    return { type: 'string', ...options };
  },

  Number(options: Schema = {}): Schema {
    return { type: 'number', ...options };
  },

  Boolean(options: Schema = {}): Schema {
    return { type: 'boolean', ...options };
  },

  Literal(value: string | number | boolean | null): Schema {
    return { const: value };
  },

  Union(schemas: Schema[], options: Schema = {}): Schema {
    return { anyOf: schemas.map(clean), ...options };
  },

  Optional(schema: Schema): OptionalSchema {
    return { ...schema, __optional: true };
  }
};
