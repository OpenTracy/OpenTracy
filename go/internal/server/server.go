package server

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/lunar-org-ai/lunar-router/go/internal/metrics"
	"github.com/lunar-org-ai/lunar-router/go/internal/provider"
	"github.com/lunar-org-ai/lunar-router/go/internal/router"
	"github.com/lunar-org-ai/lunar-router/go/internal/weights"
)

// Server is the Lunar Router HTTP server.
type Server struct {
	Router    *router.Router
	Registry  *weights.Registry
	Providers *provider.Registry
	Metrics   *metrics.Collector
	Addr      string

	httpServer *http.Server
}

// New creates a new Server.
func New(r *router.Router, reg *weights.Registry, providers *provider.Registry, host string, port int) *Server {
	s := &Server{
		Router:    r,
		Registry:  reg,
		Providers: providers,
		Metrics:   metrics.NewCollector(10000),
		Addr:      fmt.Sprintf("%s:%d", host, port),
	}

	mux := http.NewServeMux()
	s.registerRoutes(mux)

	s.httpServer = &http.Server{
		Addr:         s.Addr,
		Handler:      corsMiddleware(mux),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	return s
}

// Run starts the server and blocks until interrupted.
func (s *Server) Run() error {
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	errCh := make(chan error, 1)
	go func() {
		log.Printf("Lunar Engine listening on %s", s.Addr)
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	select {
	case <-stop:
		log.Println("Shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return s.httpServer.Shutdown(ctx)
	case err := <-errCh:
		return err
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
