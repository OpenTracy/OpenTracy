package router

import (
	"testing"
	"time"
)

func TestCacheKey(t *testing.T) {
	// Same inputs → same key
	k1 := CacheKey("hello", 0.5, []string{"a", "b"})
	k2 := CacheKey("hello", 0.5, []string{"b", "a"})
	if k1 != k2 {
		t.Error("cache key should be order-independent for models")
	}

	// Different prompt → different key
	k3 := CacheKey("world", 0.5, []string{"a", "b"})
	if k1 == k3 {
		t.Error("different prompts should produce different keys")
	}

	// Different cost weight → different key
	k4 := CacheKey("hello", 0.9, []string{"a", "b"})
	if k1 == k4 {
		t.Error("different cost weights should produce different keys")
	}

	// Nil models → different from explicit models
	k5 := CacheKey("hello", 0.5, nil)
	if k1 == k5 {
		t.Error("nil models should differ from explicit models")
	}
}

func TestCacheGetPut(t *testing.T) {
	c := NewCache(100)

	key := CacheKey("test prompt", 0.0, nil)

	// Miss
	if d := c.Get(key); d != nil {
		t.Error("expected cache miss")
	}

	// Put
	decision := &RoutingDecision{
		SelectedModel:     "model-a",
		ExpectedError:     0.05,
		CostAdjustedScore: 0.05,
		AllScores:         map[string]float64{"model-a": 0.05, "model-b": 0.7},
		ClusterID:         0,
		ClusterProbabilities: []float64{0.9, 0.05, 0.05},
	}
	c.Put(key, decision)

	// Hit
	cached := c.Get(key)
	if cached == nil {
		t.Fatal("expected cache hit")
	}
	if cached.SelectedModel != "model-a" {
		t.Errorf("selected_model = %s, want model-a", cached.SelectedModel)
	}
	if cached.ExpectedError != 0.05 {
		t.Errorf("expected_error = %v, want 0.05", cached.ExpectedError)
	}

	// Ensure it's a copy (mutation safety)
	cached.SelectedModel = "mutated"
	cached2 := c.Get(key)
	if cached2.SelectedModel != "model-a" {
		t.Error("cache returned a reference instead of a copy")
	}
}

func TestCacheEviction(t *testing.T) {
	c := NewCache(10)

	// Fill cache
	for i := 0; i < 10; i++ {
		key := CacheKey("prompt", float64(i), nil)
		c.Put(key, &RoutingDecision{SelectedModel: "m"})
	}
	if c.Len() != 10 {
		t.Errorf("cache size = %d, want 10", c.Len())
	}

	// Trigger eviction — LRU entry should be removed
	c.Put(CacheKey("overflow", 0.0, nil), &RoutingDecision{SelectedModel: "m"})
	if c.Len() != 10 {
		t.Errorf("cache size after eviction = %d, want 10", c.Len())
	}

	// The first inserted key (least recently used) should be evicted
	first := CacheKey("prompt", 0.0, nil)
	if c.Get(first) != nil {
		t.Error("LRU entry should have been evicted")
	}

	// The last inserted key should still be present
	last := CacheKey("prompt", 9.0, nil)
	if c.Get(last) == nil {
		t.Error("recent entry should still be cached")
	}
}

func TestCacheLRUPromotion(t *testing.T) {
	c := NewCache(3)

	k1 := CacheKey("a", 0, nil)
	k2 := CacheKey("b", 0, nil)
	k3 := CacheKey("c", 0, nil)

	c.Put(k1, &RoutingDecision{SelectedModel: "a"})
	c.Put(k2, &RoutingDecision{SelectedModel: "b"})
	c.Put(k3, &RoutingDecision{SelectedModel: "c"})

	// Access k1 to promote it (was LRU, now MRU)
	c.Get(k1)

	// Insert k4 — should evict k2 (now LRU), not k1
	k4 := CacheKey("d", 0, nil)
	c.Put(k4, &RoutingDecision{SelectedModel: "d"})

	if c.Get(k1) == nil {
		t.Error("k1 was promoted and should not be evicted")
	}
	if c.Get(k2) != nil {
		t.Error("k2 should have been evicted as LRU")
	}
}

func TestCacheTTLExpiry(t *testing.T) {
	c := NewCache(100)
	c.ttl = 50 * time.Millisecond // short TTL for testing

	key := CacheKey("test", 0.0, nil)
	c.Put(key, &RoutingDecision{SelectedModel: "m"})

	// Should hit immediately
	if c.Get(key) == nil {
		t.Error("expected cache hit before TTL")
	}

	// Wait for expiry
	time.Sleep(60 * time.Millisecond)

	// Should miss after TTL
	if c.Get(key) != nil {
		t.Error("expected cache miss after TTL expiry")
	}

	// Expired entry should be removed from cache
	if c.Len() != 0 {
		t.Errorf("expired entry not cleaned up, size = %d", c.Len())
	}
}

func TestCacheStats(t *testing.T) {
	c := NewCache(100)
	key := CacheKey("test", 0.0, nil)

	c.Get(key) // miss
	c.Put(key, &RoutingDecision{SelectedModel: "m"})
	c.Get(key) // hit

	stats := c.Stats()
	if stats.Hits != 1 {
		t.Errorf("hits = %d, want 1", stats.Hits)
	}
	if stats.Misses != 1 {
		t.Errorf("misses = %d, want 1", stats.Misses)
	}
	if stats.HitRate != 0.5 {
		t.Errorf("hit_rate = %v, want 0.5", stats.HitRate)
	}
	if stats.Size != 1 {
		t.Errorf("size = %d, want 1", stats.Size)
	}
}

func TestCacheClear(t *testing.T) {
	c := NewCache(100)
	key := CacheKey("test", 0.0, nil)
	c.Put(key, &RoutingDecision{SelectedModel: "m"})
	c.Get(key) // hit

	c.Clear()

	if c.Len() != 0 {
		t.Errorf("cache size after clear = %d, want 0", c.Len())
	}
	stats := c.Stats()
	if stats.Hits != 0 || stats.Misses != 0 {
		t.Error("stats should be reset after clear")
	}
	if d := c.Get(key); d != nil {
		t.Error("expected miss after clear")
	}
}
