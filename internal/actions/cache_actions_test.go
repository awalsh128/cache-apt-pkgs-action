package actions

import (
	"testing"
)

func TestNewCacheRestoreAction(t *testing.T) {
	action := NewCacheRestoreAction()

	// Test basic properties
	if action.Name != "Cache restore" {
		t.Errorf("Expected name 'Cache restore', got '%s'", action.Name)
	}

	if action.Description != "Restore cache without saving it" {
		t.Errorf(
			"Expected description 'Restore cache without saving it', got '%s'",
			action.Description,
		)
	}

	if action.Author != "GitHub" {
		t.Errorf("Expected author 'GitHub', got '%s'", action.Author)
	}

	// Test branding
	if action.Branding.Icon != "archive" {
		t.Errorf("Expected icon 'archive', got '%s'", action.Branding.Icon)
	}

	if action.Branding.Color != "gray-dark" {
		t.Errorf("Expected color 'gray-dark', got '%s'", action.Branding.Color)
	}

	// Test required inputs
	if !action.Inputs["key"].Required {
		t.Error("Expected 'key' input to be required")
	}

	if !action.Inputs["path"].Required {
		t.Error("Expected 'path' input to be required")
	}

	// Test optional inputs with defaults
	if action.Inputs["fail-on-cache-miss"].Required {
		t.Error("Expected 'fail-on-cache-miss' input to be optional")
	}

	if action.Inputs["fail-on-cache-miss"].Default != "false" {
		t.Errorf(
			"Expected 'fail-on-cache-miss' default to be 'false', got '%s'",
			action.Inputs["fail-on-cache-miss"].Default,
		)
	}

	// Test outputs
	expectedOutputs := []string{"cache-hit", "cache-primary-key", "cache-matched-key"}
	for _, expectedOutput := range expectedOutputs {
		if _, exists := action.Outputs[expectedOutput]; !exists {
			t.Errorf("Expected output '%s' to exist", expectedOutput)
		}
	}

	// Test runs configuration
	if action.Runs.Using != "node20" {
		t.Errorf("Expected runs.using 'node20', got '%s'", action.Runs.Using)
	}

	if action.Runs.Main != "dist/restore/index.js" {
		t.Errorf("Expected runs.main 'dist/restore/index.js', got '%s'", action.Runs.Main)
	}
}

func TestNewCacheSaveAction(t *testing.T) {
	action := NewCacheSaveAction()

	// Test basic properties
	if action.Name != "Cache save" {
		t.Errorf("Expected name 'Cache save', got '%s'", action.Name)
	}

	if action.Description != "Save cache with key and path" {
		t.Errorf(
			"Expected description 'Save cache with key and path', got '%s'",
			action.Description,
		)
	}

	if action.Author != "GitHub" {
		t.Errorf("Expected author 'GitHub', got '%s'", action.Author)
	}

	// Test branding
	if action.Branding.Icon != "archive" {
		t.Errorf("Expected icon 'archive', got '%s'", action.Branding.Icon)
	}

	if action.Branding.Color != "gray-dark" {
		t.Errorf("Expected color 'gray-dark', got '%s'", action.Branding.Color)
	}

	// Test required inputs
	if !action.Inputs["key"].Required {
		t.Error("Expected 'key' input to be required")
	}

	if !action.Inputs["path"].Required {
		t.Error("Expected 'path' input to be required")
	}

	// Test optional inputs
	if action.Inputs["upload-chunk-size"].Required {
		t.Error("Expected 'upload-chunk-size' input to be optional")
	}

	if action.Inputs["enableCrossOsArchive"].Required {
		t.Error("Expected 'enableCrossOsArchive' input to be optional")
	}

	if action.Inputs["enableCrossOsArchive"].Default != "false" {
		t.Errorf(
			"Expected 'enableCrossOsArchive' default to be 'false', got '%s'",
			action.Inputs["enableCrossOsArchive"].Default,
		)
	}

	// Test that save action has no outputs (as per documentation)
	if len(action.Outputs) != 0 {
		t.Errorf("Expected no outputs for save action, got %d", len(action.Outputs))
	}

	// Test runs configuration
	if action.Runs.Using != "node20" {
		t.Errorf("Expected runs.using 'node20', got '%s'", action.Runs.Using)
	}

	if action.Runs.Main != "dist/save/index.js" {
		t.Errorf("Expected runs.main 'dist/save/index.js', got '%s'", action.Runs.Main)
	}
}

func TestCacheRestoreActionString(t *testing.T) {
	action := NewCacheRestoreAction()

	// Test that String() method works without panicking
	result := action.String()
	if result == "" {
		t.Error("Expected non-empty string representation")
	}

	// Test that ShortString() method works without panicking
	shortResult := action.ShortString()
	if shortResult == "" {
		t.Error("Expected non-empty short string representation")
	}
}

func TestCacheSaveActionString(t *testing.T) {
	action := NewCacheSaveAction()

	// Test that String() method works without panicking
	result := action.String()
	if result == "" {
		t.Error("Expected non-empty string representation")
	}

	// Test that ShortString() method works without panicking
	shortResult := action.ShortString()
	if shortResult == "" {
		t.Error("Expected non-empty short string representation")
	}
}
