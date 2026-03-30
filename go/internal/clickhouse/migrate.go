package clickhouse

import (
	"context"
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	chdriver "github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// RunMigrationsFromConfig opens a temporary connection and runs all migrations.
func RunMigrationsFromConfig(cfg Config) error {
	conn, err := openConn(cfg)
	if err != nil {
		return fmt.Errorf("connect for migrations: %w", err)
	}
	defer conn.Close()
	return RunMigrations(conn)
}

// RunMigrations executes all embedded SQL migration files in order.
// Each file may contain multiple statements separated by semicolons.
// All DDL uses IF NOT EXISTS so migrations are idempotent.
func RunMigrations(conn chdriver.Conn) error {
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	// Sort by filename to ensure execution order
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		data, err := migrationsFS.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}

		if err := execStatements(conn, string(data), entry.Name()); err != nil {
			return err
		}

		log.Printf("[clickhouse] Migration applied: %s", entry.Name())
	}

	return nil
}

// execStatements splits SQL content by semicolons and executes each non-empty statement.
func execStatements(conn chdriver.Conn, sql string, filename string) error {
	statements := strings.Split(sql, ";")

	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" || isCommentOnly(stmt) {
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		err := conn.Exec(ctx, stmt)
		cancel()

		if err != nil {
			return fmt.Errorf("migration %s failed: %w\nStatement: %s", filename, err, truncate(stmt, 200))
		}
	}

	return nil
}

// isCommentOnly returns true if the string contains only SQL comments and whitespace.
func isCommentOnly(s string) bool {
	for _, line := range strings.Split(s, "\n") {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "--") {
			return false
		}
	}
	return true
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
