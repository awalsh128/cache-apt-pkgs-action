package cache

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFilePathsText(t *testing.T) {
	tests := []struct {
		name        string
		manifest    *Manifest
		expected    string
		description string
	}{
		{
			name: "empty_paths",
			manifest: &Manifest{
				FilePaths: []string{},
			},
			expected:    "",
			description: "Empty FilePaths should return empty string",
		},
		{
			name: "single_path",
			manifest: &Manifest{
				FilePaths: []string{"/path/to/file1"},
			},
			expected:    "/path/to/file1",
			description: "Single file path should be returned as is",
		},
		{
			name: "multiple_paths",
			manifest: &Manifest{
				FilePaths: []string{
					"/path/to/file1",
					"/path/to/file2",
					"/path/to/file3",
				},
			},
			expected:    "/path/to/file1\n/path/to/file2\n/path/to/file3",
			description: "Multiple file paths should be joined with newlines",
		},
		{
			name: "paths_with_special_chars",
			manifest: &Manifest{
				FilePaths: []string{
					"/path with spaces/file1",
					"/path/with/tabs\t/file2",
					"/path/with/newlines\n/file3",
				},
			},
			expected:    "/path with spaces/file1\n/path/with/tabs\t/file2\n/path/with/newlines\n/file3",
			description: "Paths with special characters should be preserved",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert := assert.New(t)
			result := tt.manifest.FilePathsText()
			assert.Equal(tt.expected, result, tt.description)
		})
	}
}
