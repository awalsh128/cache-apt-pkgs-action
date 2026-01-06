package cio

import (
	"testing"
	"time"
)

func TestPrintScanner(t *testing.T) {
	const prefix = "::local::"

	tests := []struct {
		name     string
		writes   []string
		expected []string
	}{
		{
			name: "No matching lines",
			writes: []string{
				"regular output",
				"another line",
			},
			expected: []string{},
		},
		{
			name: "Some matching lines",
			writes: []string{
				"regular output",
				"::local::matched line 1",
				"another regular line",
				"::local::matched line 2",
			},
			expected: []string{
				"::local::matched line 1",
				"::local::matched line 2",
			},
		},
		{
			name: "Mixed stdout and stderr",
			writes: []string{
				"stdout regular",
				"::local::stdout match",
				"stderr regular",
				"::local::stderr match",
			},
			expected: []string{
				"::local::stdout match",
				"::local::stderr match",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scanner, err := NewPrintScanner(prefix)
			if err != nil {
				t.Fatalf("Failed to create scanner: %v", err)
			}

			err = scanner.Start()
			if err != nil {
				t.Fatalf("Failed to start scanner: %v", err)
			}

			// Write test lines
			for _, line := range tt.writes {
				println(line)
				time.Sleep(10 * time.Millisecond) // Small delay to ensure processing
			}

			// Give scanner time to process
			time.Sleep(50 * time.Millisecond)

			err = scanner.Stop()
			if err != nil {
				t.Fatalf("Failed to stop scanner: %v", err)
			}

			// Compare results
			matches := scanner.GetMatches()
			if len(matches) != len(tt.expected) {
				t.Errorf("Got %d matches, want %d", len(matches), len(tt.expected))
			}

			for i, match := range matches {
				if i >= len(tt.expected) {
					t.Errorf("Extra match: %s", match)
					continue
				}
				if match != tt.expected[i] {
					t.Errorf("Match %d: got %s, want %s", i, match, tt.expected[i])
				}
			}
		})
	}
}
