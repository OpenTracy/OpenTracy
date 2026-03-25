package embeddings

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"unicode"
)

// BERTTokenizer implements BERT-style WordPiece tokenization.
// Compatible with all-MiniLM-L6-v2's tokenizer.
type BERTTokenizer struct {
	vocab    map[string]int32
	invVocab map[int32]string
	maxLen   int

	clsID int32 // [CLS] token
	sepID int32 // [SEP] token
	unkID int32 // [UNK] token
	padID int32 // [PAD] token
}

// NewBERTTokenizer loads a vocabulary from a vocab.txt file.
func NewBERTTokenizer(vocabPath string, maxLen int) (*BERTTokenizer, error) {
	f, err := os.Open(vocabPath)
	if err != nil {
		return nil, fmt.Errorf("open vocab: %w", err)
	}
	defer f.Close()

	vocab := make(map[string]int32)
	invVocab := make(map[int32]string)
	scanner := bufio.NewScanner(f)
	var idx int32
	for scanner.Scan() {
		token := scanner.Text()
		vocab[token] = idx
		invVocab[idx] = token
		idx++
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read vocab: %w", err)
	}

	t := &BERTTokenizer{
		vocab:    vocab,
		invVocab: invVocab,
		maxLen:   maxLen,
	}

	// Resolve special token IDs
	var ok bool
	if t.clsID, ok = vocab["[CLS]"]; !ok {
		return nil, fmt.Errorf("vocab missing [CLS]")
	}
	if t.sepID, ok = vocab["[SEP]"]; !ok {
		return nil, fmt.Errorf("vocab missing [SEP]")
	}
	if t.unkID, ok = vocab["[UNK]"]; !ok {
		return nil, fmt.Errorf("vocab missing [UNK]")
	}
	t.padID = vocab["[PAD]"] // 0 if not found, which is correct

	return t, nil
}

// TokenizeResult holds the tokenized output.
type TokenizeResult struct {
	InputIDs      []int64
	AttentionMask []int64
	TokenTypeIDs  []int64
	SeqLen        int // actual sequence length (before padding)
}

// Tokenize converts text to BERT token IDs with special tokens.
// Output: [CLS] tokens... [SEP] padded to maxLen.
func (t *BERTTokenizer) Tokenize(text string) *TokenizeResult {
	// 1. Lowercase and clean
	text = strings.ToLower(text)
	text = cleanText(text)

	// 2. Split on whitespace and punctuation
	words := tokenizeBasic(text)

	// 3. WordPiece tokenization
	var tokenIDs []int32
	for _, word := range words {
		ids := t.wordPiece(word)
		tokenIDs = append(tokenIDs, ids...)
	}

	// 4. Truncate to maxLen - 2 (room for [CLS] and [SEP])
	maxTokens := t.maxLen - 2
	if len(tokenIDs) > maxTokens {
		tokenIDs = tokenIDs[:maxTokens]
	}

	// 5. Build final sequences: [CLS] tokens [SEP] [PAD]...
	seqLen := len(tokenIDs) + 2
	inputIDs := make([]int64, t.maxLen)
	attentionMask := make([]int64, t.maxLen)
	tokenTypeIDs := make([]int64, t.maxLen) // all zeros for single sentence

	inputIDs[0] = int64(t.clsID)
	attentionMask[0] = 1
	for i, id := range tokenIDs {
		inputIDs[i+1] = int64(id)
		attentionMask[i+1] = 1
	}
	inputIDs[seqLen-1] = int64(t.sepID)
	attentionMask[seqLen-1] = 1
	// Remaining positions are already zero (PAD)

	return &TokenizeResult{
		InputIDs:      inputIDs,
		AttentionMask: attentionMask,
		TokenTypeIDs:  tokenTypeIDs,
		SeqLen:        seqLen,
	}
}

// wordPiece performs WordPiece tokenization on a single word.
func (t *BERTTokenizer) wordPiece(word string) []int32 {
	if _, ok := t.vocab[word]; ok {
		return []int32{t.vocab[word]}
	}

	var tokens []int32
	start := 0
	runes := []rune(word)

	for start < len(runes) {
		end := len(runes)
		found := false

		for end > start {
			substr := string(runes[start:end])
			if start > 0 {
				substr = "##" + substr
			}

			if id, ok := t.vocab[substr]; ok {
				tokens = append(tokens, id)
				found = true
				start = end
				break
			}
			end--
		}

		if !found {
			tokens = append(tokens, t.unkID)
			start++
		}
	}

	return tokens
}

// cleanText removes control characters and normalizes whitespace.
func cleanText(text string) string {
	var b strings.Builder
	for _, r := range text {
		if r == 0 || r == 0xFFFD || unicode.IsControl(r) {
			continue
		}
		if unicode.IsSpace(r) {
			b.WriteRune(' ')
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// tokenizeBasic splits text on whitespace and punctuation,
// keeping punctuation as separate tokens.
func tokenizeBasic(text string) []string {
	var tokens []string
	var current strings.Builder

	for _, r := range text {
		if unicode.IsSpace(r) {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			continue
		}
		if unicode.IsPunct(r) || isCJK(r) {
			if current.Len() > 0 {
				tokens = append(tokens, current.String())
				current.Reset()
			}
			tokens = append(tokens, string(r))
			continue
		}
		current.WriteRune(r)
	}
	if current.Len() > 0 {
		tokens = append(tokens, current.String())
	}
	return tokens
}

// isCJK checks if a rune is a CJK character.
func isCJK(r rune) bool {
	return (r >= 0x4E00 && r <= 0x9FFF) ||
		(r >= 0x3400 && r <= 0x4DBF) ||
		(r >= 0x20000 && r <= 0x2A6DF) ||
		(r >= 0x2A700 && r <= 0x2B73F) ||
		(r >= 0x2B740 && r <= 0x2B81F) ||
		(r >= 0x2B820 && r <= 0x2CEAF) ||
		(r >= 0xF900 && r <= 0xFAFF) ||
		(r >= 0x2F800 && r <= 0x2FA1F)
}
