package router

import (
	"container/list"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const defaultCacheMaxSize = 10000
const defaultCacheTTL = 5 * time.Minute

type cacheEntry struct {
	key       string
	decision  *RoutingDecision
	createdAt time.Time
}

// Cache is an LRU cache for routing decisions with TTL expiry.
// Thread-safe. Evicts least-recently-used entries when full.
type Cache struct {
	mu      sync.Mutex
	items   map[string]*list.Element
	order   *list.List // front = most recent
	maxSize int
	ttl     time.Duration

	hits   atomic.Int64
	misses atomic.Int64
}

// NewCache creates a routing cache with the given max size and default TTL.
func NewCache(maxSize int) *Cache {
	if maxSize <= 0 {
		maxSize = defaultCacheMaxSize
	}
	return &Cache{
		items:   make(map[string]*list.Element, 256),
		order:   list.New(),
		maxSize: maxSize,
		ttl:     defaultCacheTTL,
	}
}

// Get looks up a cached routing decision. Returns nil on miss or TTL expiry.
// Promotes the entry to the front of the LRU list on hit.
func (c *Cache) Get(key string) *RoutingDecision {
	c.mu.Lock()
	el, ok := c.items[key]
	if !ok {
		c.mu.Unlock()
		c.misses.Add(1)
		return nil
	}

	entry := el.Value.(*cacheEntry)

	// TTL check
	if time.Since(entry.createdAt) > c.ttl {
		c.order.Remove(el)
		delete(c.items, key)
		c.mu.Unlock()
		c.misses.Add(1)
		return nil
	}

	// Promote to front (most recently used)
	c.order.MoveToFront(el)
	d := entry.decision.clone()
	c.mu.Unlock()

	c.hits.Add(1)
	return d
}

// Put stores a routing decision, evicting the LRU entry if at capacity.
func (c *Cache) Put(key string, d *RoutingDecision) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Update existing entry
	if el, ok := c.items[key]; ok {
		c.order.MoveToFront(el)
		el.Value.(*cacheEntry).decision = d.clone()
		el.Value.(*cacheEntry).createdAt = time.Now()
		return
	}

	// Evict LRU if full
	for c.order.Len() >= c.maxSize {
		tail := c.order.Back()
		if tail == nil {
			break
		}
		evicted := c.order.Remove(tail).(*cacheEntry)
		delete(c.items, evicted.key)
	}

	// Insert at front
	entry := &cacheEntry{
		key:       key,
		decision:  d.clone(),
		createdAt: time.Now(),
	}
	el := c.order.PushFront(entry)
	c.items[key] = el
}

// Len returns the number of cached entries.
func (c *Cache) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.order.Len()
}

// Clear removes all cached entries and resets hit/miss counters.
func (c *Cache) Clear() {
	c.mu.Lock()
	c.items = make(map[string]*list.Element, 256)
	c.order.Init()
	c.mu.Unlock()
	c.hits.Store(0)
	c.misses.Store(0)
}

// Stats returns cache hit/miss statistics.
func (c *Cache) Stats() CacheStats {
	hits := c.hits.Load()
	misses := c.misses.Load()
	total := hits + misses
	var hitRate float64
	if total > 0 {
		hitRate = float64(hits) / float64(total)
	}
	return CacheStats{
		Size:    c.Len(),
		MaxSize: c.maxSize,
		TTL:     c.ttl.String(),
		Hits:    hits,
		Misses:  misses,
		HitRate: hitRate,
	}
}

// CacheStats holds cache performance metrics.
type CacheStats struct {
	Size    int     `json:"size"`
	MaxSize int     `json:"max_size"`
	TTL     string  `json:"ttl"`
	Hits    int64   `json:"hits"`
	Misses  int64   `json:"misses"`
	HitRate float64 `json:"hit_rate"`
}

// CacheKey builds a deterministic cache key from prompt and routing options.
func CacheKey(prompt string, costWeight float64, availableModels []string) string {
	h := md5.New()
	h.Write([]byte(prompt))
	fmt.Fprintf(h, "\x00λ=%g", costWeight)
	if len(availableModels) > 0 {
		sorted := make([]string, len(availableModels))
		copy(sorted, availableModels)
		sort.Strings(sorted)
		fmt.Fprintf(h, "\x00m=%s", strings.Join(sorted, ","))
	}
	return hex.EncodeToString(h.Sum(nil))
}

// clone returns a deep copy of the decision to prevent mutation.
func (d *RoutingDecision) clone() *RoutingDecision {
	c := *d
	if d.AllScores != nil {
		c.AllScores = make(map[string]float64, len(d.AllScores))
		for k, v := range d.AllScores {
			c.AllScores[k] = v
		}
	}
	if d.ClusterProbabilities != nil {
		c.ClusterProbabilities = make([]float64, len(d.ClusterProbabilities))
		copy(c.ClusterProbabilities, d.ClusterProbabilities)
	}
	return &c
}
