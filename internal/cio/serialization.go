// Package cio provides common I/O operations for the application.
package cio

import (
	"encoding/json"
	"fmt"
)

// FromJSON unmarshals JSON data into a value.
// This is a convenience wrapper around json.Unmarshal that maintains consistent
// JSON handling across the application.
func FromJSON(data []byte, v any) error {
	if err := json.Unmarshal(data, v); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %w", err)
	}
	return nil
}

// ToJSON marshals a value to a JSON string with consistent indentation.
// The output is always indented with two spaces for readability.
func ToJSON(v any) (string, error) {
	content, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal to JSON: %w", err)
	}
	return string(content), nil
}
