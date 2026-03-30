/**
 * GPU Instance Types — canonical source for production features.
 *
 * Re-exports from `@/constants/deployment` to keep a single source of truth
 * while letting production code import from its own feature boundary.
 *
 * When the data eventually comes from an API, only this file needs to change.
 */

export { INSTANCE_TYPES } from '@/constants/deployment';
