// Type shim for @aws-amplify/backend so tsc can resolve amplify resource
// imports in CI without the full backend package installed.
// The actual types are provided by the package in local development.
declare module '@aws-amplify/backend' {
  export const a: any;
  export function defineData(config: any): any;
  export function defineFunction(config: any): any;
  export type ClientSchema<T> = any;
}
