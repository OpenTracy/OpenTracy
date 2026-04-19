-- Auto-executed on first ClickHouse container start.
-- Creates the `opentracy` database so the Go engine migrations can run.
-- Also preserves legacy `lunar_router` database if it exists (pre-rebrand
-- deployments) so operators can RENAME TABLE … TO opentracy.<table> manually
-- after reviewing their data. We do not rename automatically to avoid surprising
-- existing deployments; see CHANGELOG for the recommended migration steps.
CREATE DATABASE IF NOT EXISTS opentracy;
CREATE DATABASE IF NOT EXISTS lunar_router;
