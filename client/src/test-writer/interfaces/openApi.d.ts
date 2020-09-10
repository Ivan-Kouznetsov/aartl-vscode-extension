export interface IOpenApiDocSegment {
  definitions?: { [key: string]: any };
  properties?: IOpenApiProp[];
}

export interface IOpenApiProp {
  $ref?: string;
  format: string;
  title?: string;
  description?: string;
  default?: any;
  multipleOf?: string;
  maximum?: number;
  exclusiveMaximum?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: number;
  maxProperties?: number;
  minProperties?: number;
  required?: boolean;
  enum?: string[];
  type: string;
  properties: IOpenApiProp[];
  items?: { $ref?: string; type?: string };
}
