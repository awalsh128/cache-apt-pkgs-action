package cio

import (
	"encoding/json"
	"fmt"
)

// FromJSON unmarshals JSON data into a value with consistent error handling.
// It wraps json.Unmarshal to provide standardized JSON parsing across the application.
// Returns an error if the JSON data is invalid or cannot be unmarshaled into the target type.
func FromJSON(data []byte, v any) error {
	if err := json.Unmarshal(data, v); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %w", err)
	}
	return nil
}

// ToJSON marshals a value to a JSON string with consistent formatting.
// It uses two-space indentation for readability and standardized output.
// Returns the JSON string and any error that occurred during marshaling.
func ToJSON(v any) (string, error) {
	content, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal to JSON: %w", err)
	}
	return string(content), nil
}
