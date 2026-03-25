package embeddings

// Embedder generates vector embeddings from text.
type Embedder interface {
	// Embed generates an embedding vector for the given text.
	Embed(text string) ([]float64, error)
	// Dimension returns the embedding vector dimension.
	Dimension() int
	// Close releases any resources held by the embedder.
	Close() error
}
