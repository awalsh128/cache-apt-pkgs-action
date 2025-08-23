package cache

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

type Manifest struct {
	CacheKey     Key
	FilePaths    []string
	LastModified time.Time
}

func (m *Manifest) FilePathsText() string {
	var lines []string
	lines = append(lines, m.FilePaths...)
	return strings.Join(lines, "\n")
}

func (m *Manifest) Json() (string, error) {
	content, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal manifest to JSON: %w", err)
	}
	return string(content), nil
}

func ReadJson(filepath string) (*Manifest, error) {
	file, err := os.Open(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to open manifest at %s: %w", filepath, err)
	}
	defer file.Close()

	content, err := os.ReadFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to read manifest at %s: %w", filepath, err)
	}

	var manifest Manifest
	if err := json.Unmarshal(content, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse manifest JSON: %w", err)
	}
	return &manifest, nil
}

func Write(filepath string, manifest *Manifest) error {
	file, err := os.Create(filepath)
	if err != nil {
		return fmt.Errorf("failed to create manifest at %s: %w", filepath, err)
	}
	defer file.Close()

	content, err := manifest.Json()
	if err != nil {
		return fmt.Errorf("failed to serialize manifest to %s: %v", filepath, err)
	}
	if _, err := file.Write([]byte(content)); err != nil {
		return fmt.Errorf("failed to write manifest to %s: %v", filepath, err)
	}
	fmt.Printf("Manifest written to %s\n", filepath)
	return nil
}
